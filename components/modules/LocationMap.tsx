'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { circle as turfCircle, lineString, length as turfLength, along } from '@turf/turf';
import { useAppStore } from '@/store/useAppStore';
import { project } from '@/lib/data';
import type { Poi } from '@/lib/types';

/**
 * Token-free satellite map:
 *  - ESRI World Imagery raster tiles (satellite) + ESRI reference overlays (roads / place labels)
 *  - Routing via the public OSRM demo server (driving), straight-line fallback
 *  - If NEXT_PUBLIC_MAPBOX_TOKEN is set, Mapbox satellite-streets raster tiles are used instead for higher zoom detail
 */
const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const [CLNG, CLAT] = project.project.center;
const RINGS = [0.5, 1, 2];
const DISTANCE_CHIPS: { label: string; km: number | null }[] = [
  { label: '500 M', km: 0.5 }, { label: '1 KM', km: 1 }, { label: '2 KM', km: 2 }, { label: '5 KM', km: 5 }, { label: 'ALL', km: null },
];
const PIN_SVG = `<svg viewBox="0 0 34 44" width="34" height="44" xmlns="http://www.w3.org/2000/svg"><path d="M17 1C8.2 1 1 8.1 1 16.8 1 28.4 17 43 17 43s16-14.6 16-26.2C33 8.1 25.8 1 17 1z" fill="#FF2D78" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="6" fill="#fff"/></svg>`;

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satellite: MAPBOX
      ? { type: 'raster', tiles: [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX}`], tileSize: 512, maxzoom: 22, attribution: '© Mapbox © Maxar' }
      : { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
    terrain: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: 'Terrain: Mapzen / AWS' },
    osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap contributors, OpenFreeMap' },
    roads: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
    places: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.05, 'raster-contrast': 0.05 } },
    { id: 'hillshade', type: 'hillshade', source: 'terrain', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#1a1a1a' } },
    ...(MAPBOX ? [] : [
      { id: 'roads', type: 'raster' as const, source: 'roads', paint: { 'raster-opacity': 0.85 } },
      { id: 'places', type: 'raster' as const, source: 'places', paint: { 'raster-opacity': 0.9 } },
    ]),
    // real 3D buildings from OpenStreetMap footprints (OpenMapTiles schema)
    { id: 'buildings-3d', type: 'fill-extrusion', source: 'osm', 'source-layer': 'building', minzoom: 13,
      paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#e9e5dc', 40, '#f6f3ec'], 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.92, 'fill-extrusion-vertical-gradient': true } },
  ],
  terrain: { source: 'terrain', exaggeration: 1.15 },
};

function visiblePois(categories: Record<string, boolean>, distance: number | null): Poi[] {
  return project.pois.filter((p) => categories[p.category] && (distance === null || p.distance <= distance));
}
const fmtRoute = (km: number, mins: number) => `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}  |  ${mins} mins`;

export default function LocationMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<string, maplibregl.Marker>>({});
  const ringLabels = useRef<maplibregl.Marker[]>([]);
  const routeLabel = useRef<maplibregl.Marker | null>(null);
  const dashRaf = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);

  const categories = useAppStore((s) => s.categories);
  const distanceFilter = useAppStore((s) => s.distanceFilter);
  const setDistanceFilter = useAppStore((s) => s.setDistanceFilter);
  const selectedPoiId = useAppStore((s) => s.selectedPoiId);
  const selectPoi = useAppStore((s) => s.selectPoi);
  const leftOpen = useAppStore((s) => s.leftOpen);

  /* ---------------- init ---------------- */
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: container.current, style: STYLE, center: [CLNG, CLAT], zoom: 15.2, pitch: 58, bearing: -22, attributionControl: false, maxPitch: 78 });
    map.addControl(new maplibregl.TerrainControl({ source: 'terrain', exaggeration: 1.15 }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');

    map.on('load', () => {
      const rings = { type: 'FeatureCollection' as const, features: RINGS.map((km) => turfCircle([CLNG, CLAT], km, { steps: 96, units: 'kilometers', properties: { km } })) };
      map.addSource('rings', { type: 'geojson', data: rings });
      map.addLayer({ id: 'rings-fill', type: 'fill', source: 'rings', paint: { 'fill-color': '#22C55E', 'fill-opacity': 0.06 } });
      map.addLayer({ id: 'rings-line', type: 'line', source: 'rings', paint: { 'line-color': '#22C55E', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.95 } });
      RINGS.forEach((km) => {
        const el = document.createElement('div');
        el.className = 'ring-label';
        el.textContent = km < 1 ? `${km * 1000} m` : `${km} km`;
        ringLabels.current.push(new maplibregl.Marker({ element: el }).setLngLat([CLNG, CLAT + km / 111]).addTo(map));
      });

      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0b2a5e', 'line-width': 9, 'line-opacity': 0.8 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3B82F6', 'line-width': 5 } });
      map.addLayer({ id: 'route-dash', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-dasharray': [0, 4, 3] } });

      map.addSource('site', { type: 'geojson', data: turfCircle([CLNG, CLAT], 0.09, { steps: 48, units: 'kilometers' }) });
      map.addLayer({ id: 'site-glow', type: 'fill', source: 'site', paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'site-line', type: 'line', source: 'site', paint: { 'line-color': '#3B82F6', 'line-width': 2 } });
      const el = document.createElement('div');
      el.className = 'flex flex-col items-center';
      el.innerHTML = `<div class="navigo-project-dot"></div><div class="mt-1 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-bold tracking-[0.2em] text-white">${project.project.name}</div>`;
      new maplibregl.Marker({ element: el, anchor: 'top' }).setLngLat([CLNG, CLAT]).addTo(map);
      setLoaded(true);
    });

    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    return () => { ro.disconnect(); cancelAnimationFrame(dashRaf.current); map.remove(); mapRef.current = null; };
  }, []);

  /* ---------------- pins ---------------- */
  useEffect(() => {
    const map = mapRef.current; if (!map || !loaded) return;
    const wanted = visiblePois(categories, distanceFilter);
    const ids = new Set(wanted.map((p) => p.id));
    Object.entries(markers.current).forEach(([id, m]) => { if (!ids.has(id)) { m.remove(); delete markers.current[id]; } });
    wanted.forEach((p, i) => {
      if (markers.current[p.id]) { markers.current[p.id].getElement().classList.toggle('active', p.id === selectedPoiId); return; }
      const el = document.createElement('div');
      el.className = `navigo-pin${p.id === selectedPoiId ? ' active' : ''}`;
      el.style.animationDelay = `${i * 60}ms`;
      el.innerHTML = PIN_SVG; el.title = p.name;
      el.addEventListener('click', (e) => { e.stopPropagation(); selectPoi(p.id); });
      markers.current[p.id] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
    });
  }, [categories, distanceFilter, loaded, selectedPoiId, selectPoi]);

  /* ---------------- route ---------------- */
  useEffect(() => {
    const map = mapRef.current; if (!map || !loaded) return;
    cancelAnimationFrame(dashRaf.current);
    routeLabel.current?.remove(); routeLabel.current = null;
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined; if (!src) return;
    const poi = project.pois.find((p) => p.id === selectedPoiId);
    if (!poi) { src.setData({ type: 'FeatureCollection', features: [] }); return; }
    let cancelled = false;
    (async () => {
      let coords: [number, number][] = [[poi.lng, poi.lat], [CLNG, CLAT]];
      let km = poi.distance, mins = poi.travelMins;
      try {
        const url = MAPBOX
          ? `https://api.mapbox.com/directions/v5/mapbox/driving/${poi.lng},${poi.lat};${CLNG},${CLAT}?geometries=geojson&overview=full&access_token=${MAPBOX}`
          : `https://router.project-osrm.org/route/v1/driving/${poi.lng},${poi.lat};${CLNG},${CLAT}?geometries=geojson&overview=full`;
        const r = (await (await fetch(url)).json())?.routes?.[0];
        if (r?.geometry?.coordinates) { coords = r.geometry.coordinates; km = r.distance / 1000; mins = Math.max(1, Math.round(r.duration / 60)); }
      } catch { /* offline fallback */ }
      if (cancelled) return;
      const line = lineString(coords);
      src.setData({ type: 'FeatureCollection', features: [line] });
      const mid = along(line, turfLength(line, { units: 'kilometers' }) / 2, { units: 'kilometers' });
      const el = document.createElement('div'); el.className = 'route-label'; el.textContent = fmtRoute(km, mins);
      routeLabel.current = new maplibregl.Marker({ element: el }).setLngLat(mid.geometry.coordinates as [number, number]).addTo(map);
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(b, { padding: { top: 110, bottom: 160, left: leftOpen ? 360 : 80, right: 420 }, duration: 1100, pitch: 50 });
      const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
      let step = 0;
      const tick = (ts: number) => { const s = Math.floor((ts / 60) % seq.length); if (s !== step && map.getLayer('route-dash')) { map.setPaintProperty('route-dash', 'line-dasharray', seq[s]); step = s; } dashRaf.current = requestAnimationFrame(tick); };
      dashRaf.current = requestAnimationFrame(tick);
    })();
    return () => { cancelled = true; };
  }, [selectedPoiId, loaded, leftOpen]);

  /* ---------------- distance chips ---------------- */
  useEffect(() => {
    const map = mapRef.current; if (!map || !loaded || selectedPoiId) return;
    const zoom = distanceFilter === 0.5 ? 16 : distanceFilter === 1 ? 15 : distanceFilter === 2 ? 14 : distanceFilter === 5 ? 12.6 : 15.2;
    map.easeTo({ center: [CLNG, CLAT], zoom, pitch: distanceFilter === 5 ? 35 : 58, duration: 900 });
  }, [distanceFilter, loaded, selectedPoiId]);

  return (
    <div className="absolute inset-0 bg-ink">
      <div ref={container} className="absolute inset-0" onClick={() => selectPoi(null)} />
      {!loaded && <div className="absolute inset-0 grid place-items-center bg-ink"><div className="shimmer h-32 w-64 rounded-2xl" /></div>}
      <div className="pointer-events-none absolute left-5 top-24 z-10 hidden max-w-xs md:block">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-200 drop-shadow">Location</p>
        <h1 className="mt-1 text-2xl font-semibold drop-shadow-lg">{project.project.address}</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-100 drop-shadow">Real terrain, real buildings, real drive times. One minute to NGRI Metro, next to Uppal Stadium.</p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
        <div className="pointer-events-auto glass flex gap-1 rounded-full p-1">
          {DISTANCE_CHIPS.map((c) => (
            <button key={c.label} onClick={() => setDistanceFilter(c.km)} className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] transition ${distanceFilter === c.km ? 'bg-ring text-black' : 'text-neutral-300 hover:text-white'}`}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
