'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Sky, useGLTF } from '@react-three/drei';
import { EffectComposer, Outline, Selection, Select } from '@react-three/postprocessing';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { create } from 'zustand';
import { useAppStore } from '@/store/useAppStore';
import { project, assetUrl, STATUS_COLOR } from '@/lib/data';
import type { ConstructionPhase, Flat, Tower } from '@/lib/types';
import { asphaltTexture, facadeTextures, glassRailMaterial, grassTexture, stoneTexture, waterMaterial } from '@/lib/siteLook';
import { makeFloorCanvas, plateSlots3D, type PlateShape } from '@/lib/floorPlate';
import { AMENITIES_ON_PLOT, SFT_COLOR, STATUS_DOT } from '@/lib/palette';
import SftLegend from '@/components/SftLegend';
import { lockCanvasScroll } from '@/lib/lockCanvasScroll';

/* ================================================================== */
/* Scene constants — 1 unit = 1 metre, origin = site centre            */
/* ================================================================== */
const FH = project.project.floorHeight; // 3.1 m
const PODIUM_H = 4; // podium deck height (basement + stilt)
const [CLNG, CLAT] = project.project.center;
const ACCENT = new THREE.Color('#c4a057');
const BLACK = new THREE.Color('#000000');
const deg = (d: number) => (d * Math.PI) / 180;
const towerById = (id: string) => project.towers.find((t) => t.id === id)!;
const towerLevels = (t: Tower) => t.floors + 1; // G + N
const towerTop = (t: Tower) => PODIUM_H + towerLevels(t) * FH;
const towerShape = (t: Tower): PlateShape => t.shape ?? (t.id === 'A' || t.id === 'F' ? 'bar' : 'cross');
/** tower-local (x, z) → world, honouring the row tilt */
const localToWorld = (t: Tower, lx: number, lz: number, y = 0) => {
  const r = deg(t.rotation); const c = Math.cos(r), s = Math.sin(r);
  return new THREE.Vector3(t.position[0] + lx * c + lz * s, y, t.position[1] - lx * s + lz * c);
};
const towerDir = (t: Tower, lx: number, lz: number) => localToWorld(t, lx, lz).sub(new THREE.Vector3(t.position[0], 0, t.position[1])).normalize();
/** equal-spacing fallback when the floor plate has not been built yet */
const flatLocalEqual = (t: Tower, idx: number) => {
  const [w, d] = t.footprint; const side = idx < 5 ? 1 : -1; const k = idx % 5;
  return { lx: (side * w) / 4, lz: -d / 2 + ((k + 0.5) * d) / 5, side, pw: d / 5, pd: w / 2 };
};
const slotForFlat = (t: Tower, flat: Flat, peers?: Flat[]) => {
  const flats = peers ?? project.flats.filter((f) => f.tower === t.id && f.floor === flat.floor);
  const hit = plateSlots3D(flats, t.footprint, towerShape(t)).find((s) => s.flat.id === flat.id);
  return hit ?? flatLocalEqual(t, Number(flat.flatNo) - 1);
};

/* ================================================================== */
/* Web-mercator helpers                                                */
/* ================================================================== */
const EARTH = 6378137;
const toMerc = (lng: number, lat: number) => ({ x: (lng * Math.PI * EARTH) / 180, y: EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) });
const ORIGIN = toMerc(CLNG, CLAT);
const MERC_SCALE = Math.cos((CLAT * Math.PI) / 180);
const toScene = (lng: number, lat: number) => { const m = toMerc(lng, lat); return { x: (m.x - ORIGIN.x) * MERC_SCALE, z: -(m.y - ORIGIN.y) * MERC_SCALE }; };
const tileXY = (lng: number, lat: number, z: number) => { const n = 2 ** z; return { x: Math.floor(((lng + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n) }; };
const tileToLngLat = (x: number, y: number, z: number) => { const n = 2 ** z; return { lng: (x / n) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI }; };
const ESRI = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

/* ================================================================== */
/* Camera goal store                                                   */
/* ================================================================== */
interface CamGoal { pos: THREE.Vector3; target: THREE.Vector3 }
interface CamState { goal: CamGoal | null; nonce: number; azimuth: number; fly: (g: CamGoal) => void; setAzimuth: (a: number) => void }
export const useCam = create<CamState>((set) => ({ goal: null, nonce: 0, azimuth: 0, fly: (goal) => set((s) => ({ goal, nonce: s.nonce + 1 })), setAzimuth: (azimuth) => set({ azimuth }) }));
const BIRD_EYE: CamGoal = { pos: new THREE.Vector3(215, 135, -120), target: new THREE.Vector3(0, 22, 0) };
const ELEVATION: CamGoal = { pos: new THREE.Vector3(235, 32, -135), target: new THREE.Vector3(0, 26, 0) };

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/* ================================================================== */
/* Facade texture: plaster + UPVC windows + balcony rail, per floor    */
/* ================================================================== */
function makeFacade() {
  return facadeTextures();
}

/* ================================================================== */
/* Satellite ground                                                    */
/* ================================================================== */
function Tile({ url, x, z, w, h, y }: { url: string; x: number; z: number; w: number; h: number; y: number }) {
  const tex = useLoader(THREE.TextureLoader, url); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} roughness={1} /></mesh>;
}
function SatelliteGround() {
  const layers = useMemo(() => {
    const build = (z: number, radius: number, y: number) => {
      const c = tileXY(CLNG, CLAT, z); const tiles: { url: string; x: number; z: number; w: number; h: number; y: number }[] = [];
      for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
        const tx = c.x + dx, ty = c.y + dy; const nw = tileToLngLat(tx, ty, z), se = tileToLngLat(tx + 1, ty + 1, z);
        const a = toScene(nw.lng, nw.lat), b = toScene(se.lng, se.lat);
        tiles.push({ url: ESRI(z, tx, ty), x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: Math.abs(b.x - a.x) + 0.05, h: Math.abs(b.z - a.z) + 0.05, y });
      }
      return tiles;
    };
    return [...build(14, 3, -0.9), ...build(17, 3, -0.4), ...build(19, 4, -0.1)]; // 16 km context, 2 km mid, 650 m crisp (~0.3 m/px)
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}><planeGeometry args={[40000, 40000]} /><meshStandardMaterial color="#23261f" /></mesh>
      {layers.map((t) => <Quiet key={t.url}><Suspense fallback={null}><Tile {...t} /></Suspense></Quiet>)}
    </group>
  );
}

/* ================================================================== */
/* Real neighbourhood from OSM footprints                              */
/* ================================================================== */
interface OsmWay { type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
const SITE_RADIUS = 105;
function OsmBuildings() {
  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false; const key = `osm-buildings-v2-${CLAT}-${CLNG}`;
    const build = (elements: OsmWay[]) => {
      const parts: THREE.BufferGeometry[] = [];
      for (const w of elements) {
        if (!w.geometry || w.geometry.length < 4) continue;
        const pts = w.geometry.map((g) => toScene(g.lon, g.lat));
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
        if (Math.hypot(cx, cz) < SITE_RADIUS) continue;
        const t = w.tags ?? {};
        const h = t.height ? parseFloat(t.height) : t['building:levels'] ? parseFloat(t['building:levels']) * 3.1 : 5 + Math.random() * 7;
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.z))), { depth: h, bevelEnabled: false });
        g.rotateX(Math.PI / 2); g.scale(1, -1, 1); g.computeVertexNormals(); parts.push(g);
      }
      if (!parts.length) return null; const merged = mergeGeometries(parts, false); parts.forEach((p) => p.dispose()); return merged;
    };
    try { const cached = localStorage.getItem(key); if (cached) { const g = build(JSON.parse(cached)); if (g) { setGeom(g); return; } } } catch { /* ignore */ }
    const q = `[out:json][timeout:40];(way["building"](around:1500,${CLAT},${CLNG}););out geom;`;
    const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter'];
    const tryFetch = async (i: number): Promise<{ elements: OsmWay[] }> => {
      try { const r = await fetch(endpoints[i], { method: 'POST', body: 'data=' + encodeURIComponent(q) }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
      catch (err) { if (i + 1 < endpoints.length) return tryFetch(i + 1); throw err; }
    };
    tryFetch(0)
      .then((j: { elements: OsmWay[] }) => { if (cancelled) return; const slim = j.elements.map((w) => ({ type: w.type, tags: w.tags, geometry: w.geometry })); try { localStorage.setItem(key, JSON.stringify(slim)); } catch { /* quota */ } const g = build(slim); if (g) setGeom(g); else setFailed(true); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  if (geom) return <mesh geometry={geom} castShadow receiveShadow><meshStandardMaterial map={facadeTextures().map} color="#d4cfc4" roughness={0.88} /></mesh>;
  if (!failed) return null;
  return <group>{Array.from({ length: 80 }, (_, i) => { const a = (i / 80) * Math.PI * 2, r = 170 + (i % 7) * 42, h = 10 + (i % 6) * 6; return <mesh key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} castShadow receiveShadow><boxGeometry args={[14 + (i % 3) * 4, h, 12 + (i % 2) * 6]} /><meshStandardMaterial map={facadeTextures().map} color="#d2cdc2" roughness={0.88} /></mesh>; })}</group>;
}

/* ================================================================== */
/* Podium, landscape, boundary, trees                                  */
/* ================================================================== */
function Tree({ position, scale = 1, seed = 0 }: { position: [number, number, number]; scale?: number; seed?: number }) {
  const greens = ['#2f6a2a', '#3d7c32', '#4a8a38', '#2a5c26'];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.5, 0]} castShadow><cylinderGeometry args={[0.14, 0.22, 3.0, 6]} /><meshStandardMaterial color="#4a3828" roughness={1} /></mesh>
      <mesh position={[0, 3.7, 0]} castShadow><sphereGeometry args={[1.65, 10, 8]} /><meshStandardMaterial color={greens[seed % 4]} roughness={1} /></mesh>
      <mesh position={[0.85, 4.4, 0.25]} castShadow><sphereGeometry args={[1.15, 8, 7]} /><meshStandardMaterial color={greens[(seed + 1) % 4]} roughness={1} /></mesh>
      <mesh position={[-0.7, 4.55, -0.35]} castShadow><sphereGeometry args={[1.05, 8, 7]} /><meshStandardMaterial color={greens[(seed + 2) % 4]} roughness={1} /></mesh>
      <mesh position={[0.15, 5.15, -0.55]} castShadow><sphereGeometry args={[0.85, 8, 6]} /><meshStandardMaterial color={greens[(seed + 3) % 4]} roughness={1} /></mesh>
    </group>
  );
}
function Podium() {
  const t0 = project.towers[0];
  const rot = deg(t0.rotation);
  const floorOpen = useAppStore((s) => s.selectedFloor) !== null;
  const grass = useMemo(() => { const t = grassTexture().clone(); t.repeat.set(18, 26); t.needsUpdate = true; return t; }, []);
  const asphalt = useMemo(() => { const t = asphaltTexture().clone(); t.repeat.set(2, 28); t.needsUpdate = true; return t; }, []);
  const stone = useMemo(() => { const t = stoneTexture().clone(); t.repeat.set(8, 2); t.needsUpdate = true; return t; }, []);
  const water = useMemo(() => waterMaterial(), []);
  const trees = useMemo(() => {
    let seed = 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const list: { p: [number, number, number]; s: number; k: number }[] = [];
    for (let i = 0; i < 90; i++) { const lx = 30 + rnd() * 22, lz = -80 + rnd() * 160; list.push({ p: [lx, PODIUM_H, lz], s: 0.95 + rnd() * 0.9, k: i }); }
    for (let i = 0; i < 50; i++) { const lx = -52 + rnd() * 12, lz = -80 + rnd() * 160; list.push({ p: [lx, PODIUM_H, lz], s: 0.85 + rnd() * 0.75, k: i + 90 }); }
    return list;
  }, []);
  return (
    <group rotation={[0, -rot, 0]}>
      {/* stone-clad podium volume */}
      <mesh position={[0, PODIUM_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[124, PODIUM_H, 180]} />
        <meshStandardMaterial map={stone} color="#cfc8bc" roughness={0.92} />
      </mesh>
      {/* lawn deck — the whole site, not a white plate */}
      <mesh position={[0, PODIUM_H + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[122, 178]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* paved arrival plaza */}
      <mesh position={[-48, PODIUM_H + 0.06, 64]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 36]} />
        <meshStandardMaterial color="#b7b1a6" roughness={0.95} />
      </mesh>
      {/* 7M west driveway */}
      <mesh position={[-56, PODIUM_H + 0.07, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 168]} />
        <meshStandardMaterial map={asphalt} roughness={0.95} />
      </mesh>
      {/* party lawn — amenity 15 */}
      <mesh position={[4, PODIUM_H + 0.08, 10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#6f9a4e" roughness={1} />
      </mesh>
      {/* kids play — amenity 13 */}
      <mesh position={[6, PODIUM_H + 0.1, 72]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 32]} />
        <meshStandardMaterial color="#d4a574" roughness={0.9} />
      </mesh>
      {/* amphitheatre — amenity 12 */}
      <mesh position={[50, PODIUM_H + 0.1, 74]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[4.2, 9.5, 24, 1, 0, Math.PI]} />
        <meshStandardMaterial color="#cfc6b4" side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      {/* pool deck + water near clubhouse */}
      <mesh position={[52, PODIUM_H + 0.08, -52]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 22]} />
        <meshStandardMaterial color="#e4dfd4" roughness={0.7} />
      </mesh>
      <mesh position={[52, PODIUM_H + 0.14, -52]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 16]} />
        <primitive object={water} attach="material" />
      </mesh>
      {/* basketball — amenity 4 */}
      <mesh position={[-54, PODIUM_H + 0.08, -72]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 22]} />
        <meshStandardMaterial color="#c4a06a" roughness={1} />
      </mesh>
      {/* cricket net — amenity 6 */}
      <mesh position={[6, PODIUM_H + 0.08, -80]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 18]} />
        <meshStandardMaterial color="#5a7a48" roughness={1} />
      </mesh>
      {/* 50,000 sft clubhouse — NE corner, amenity 8 */}
      <group position={[52, PODIUM_H, -72]}>
        <mesh position={[0, 4.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[24, 9.2, 32]} />
          <meshStandardMaterial color="#efe8dc" roughness={0.62} />
        </mesh>
        <mesh position={[12.05, 4.2, 0]}>
          <boxGeometry args={[0.12, 7.4, 28]} />
          <meshPhysicalMaterial color="#8fb4c8" roughness={0.08} metalness={0.15} transparent opacity={0.45} />
        </mesh>
        <mesh position={[0, 9.5, 0]} castShadow>
          <boxGeometry args={[26, 0.55, 34]} />
          <meshStandardMaterial color="#f4efe6" roughness={0.8} />
        </mesh>
        {[-10, -3.3, 3.3, 10].map((z) => (
          <mesh key={z} position={[12.2, 2.4, z]} castShadow>
            <boxGeometry args={[0.45, 4.8, 0.45]} />
            <meshStandardMaterial color="#d8cfc0" roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* boundary */}
      {[[0, -90, 124, 0.7], [0, 90, 124, 0.7], [-62, 0, 0.7, 180], [62, 0, 0.7, 180]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, PODIUM_H + 1.15, z]} castShadow>
          <boxGeometry args={[w, 2.3, d]} />
          <meshStandardMaterial map={stone} color="#c4bdb0" roughness={0.95} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} position={[-42.2, PODIUM_H + 0.55, -68 + i * 12]}>
          <mesh castShadow>
            <boxGeometry args={[1.9, 0.55, 4.2]} />
            <meshStandardMaterial color={['#e8e4df', '#1c1c1c', '#6d7380', '#9a1f28'][i % 4]} metalness={0.72} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.55, -0.15]}>
            <boxGeometry args={[1.7, 0.55, 2.2]} />
            <meshStandardMaterial color={['#e8e4df', '#1c1c1c', '#6d7380', '#9a1f28'][i % 4]} metalness={0.72} roughness={0.28} />
          </mesh>
        </group>
      ))}
      {trees.map((t) => <Tree key={t.k} position={t.p} scale={t.s} seed={t.k} />)}
      {!floorOpen && AMENITIES_ON_PLOT.map((a) => (
        <Html key={a.n} position={[a.x, PODIUM_H + 2.4, a.z]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-[#1e3a5f]/30 bg-[#f3efe6] text-[11px] font-bold text-[#1e3a5f] shadow-glow">{a.n}</div>
            <div className="mt-0.5 whitespace-nowrap rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em] text-white/90">{a.name.toUpperCase()}</div>
          </div>
        </Html>
      ))}
    </group>
  );
}

function TowerRoofCad({ tower }: { tower: Tower }) {
  const flats = useMemo(
    () => project.flats.filter((f) => f.tower === tower.id && f.floor === 10),
    [tower.id],
  );
  const tex = useMemo(() => {
    if (!flats.length) return null;
    const { canvas } = makeFloorCanvas(flats, null, {}, towerShape(tower));
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [flats, tower]);
  useEffect(() => () => { tex?.dispose(); }, [tex]);
  if (!tex) return null;
  const [w, d] = tower.footprint;
  return (
    <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} receiveShadow>
      <planeGeometry args={[d + 0.15, w + 0.15]} />
      <meshStandardMaterial map={tex} roughness={0.88} metalness={0.02} />
    </mesh>
  );
}

/* ================================================================== */
/* Towers: per-floor box segments (cut-away capable) + balconies       */
/* ================================================================== */
function TowerBlock({ tower, tex }: { tower: Tower; tex: ReturnType<typeof makeFacade> }) {
  const selectTower = useAppStore((s) => s.selectTower);
  const setHovered = useAppStore((s) => s.setHoveredTower);
  const setRightOpen = useAppStore((s) => s.setRightOpen);
  const hovered = useAppStore((s) => s.hoveredTower) === tower.id;
  const selected = useAppStore((s) => s.selectedTower) === tower.id;
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const anySelected = useAppStore((s) => s.selectedTower);
  const phase = useAppStore((s) => s.constructionPhase);
  const cutAt = anySelected && selectedFloor !== null ? selectedFloor : null; // slice every tower at the opened floor
  const [w, d] = tower.footprint; const levels = towerLevels(tower);
  const isCross = towerShape(tower) === 'cross';
  const showFacade = phase === 'facade' || phase === 'complete';
  const showFrame = phase === 'pillars' || phase === 'structure';

  const railGlass = useMemo(() => glassRailMaterial(), []);
  const mats = useMemo(() => {
    const side = (len: number) => { const map = tex.map.clone(); map.repeat.set(len / (tex.bayWidth * 4), 1); map.needsUpdate = true; const em = tex.emissive.clone(); em.repeat.copy(map.repeat); em.needsUpdate = true; return new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color('#ffb070'), emissiveIntensity: 0.5, roughness: 0.6, metalness: 0.05, color: tower.tint, transparent: true }); };
    const plain = new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.9, transparent: true });
    // BoxGeometry material order: +x, -x, +y, -y, +z, -z
    return Array.from({ length: levels }, () => [side(d), side(d), plain.clone(), plain.clone(), side(w), side(w)]);
  }, [tex, w, d, levels, tower.tint]);

  useEffect(() => {
    mats.forEach((set, floor) => set.forEach((m) => {
      const ghost = cutAt !== null && floor > cutAt;
      m.opacity = 1; m.depthWrite = true; m.visible = !ghost;
      const mm = m as THREE.MeshStandardMaterial; mm.emissiveIntensity = mm.emissiveMap ? 0.18 + (hovered && !selected ? 0.12 : 0) : 0;
    }));
  }, [mats, cutAt, hovered, selected]);

  return (
    <group position={[tower.position[0], 0, tower.position[1]]} rotation={[0, -deg(tower.rotation), 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(tower.id); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(null); document.body.style.cursor = 'auto'; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); selectTower(tower.id); setRightOpen(true); }}
    >
      {phase === 'foundation' && (
        <group>
          <mesh position={[0, PODIUM_H - 2.2, 0]} castShadow receiveShadow><boxGeometry args={[w + 4, 1.2, d + 4]} /><meshStandardMaterial color="#aea79b" roughness={0.95} /></mesh>
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * w * 0.34, PODIUM_H - 4.3, z * d * 0.36]} castShadow><cylinderGeometry args={[1.25, 1.65, 7, 12]} /><meshStandardMaterial color="#817a70" roughness={1} /></mesh>))}
        </group>
      )}
      {showFrame && (
        <group>
          {Array.from({ length: phase === 'pillars' ? 5 : levels }, (_, floor) => {
            const y = PODIUM_H + floor * FH;
            return <group key={floor}>
              <mesh position={[0, y + 0.16, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.32, d]} /><meshStandardMaterial color="#c9c4bb" roughness={0.95} /></mesh>
              {[-1, 0, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * w * 0.38, y + FH / 2, z * d * 0.38]} castShadow><boxGeometry args={[0.72, FH, 0.72]} /><meshStandardMaterial color="#9e978c" roughness={1} /></mesh>))}
            </group>;
          })}
        </group>
      )}
      {showFacade && mats.map((set, floor) => {
        const y = PODIUM_H + floor * FH + FH / 2; const ghost = cutAt !== null && floor > cutAt;
        const lobby = floor === 0;
        const bodyW = lobby ? w - 1.2 : w - 0.4;
        const bodyD = d - 0.35;
        const stemW = isCross ? bodyW * 0.38 : bodyW;
        const armD = isCross ? bodyD * 0.38 : bodyD;
        const bay = isCross ? 3 : 5;
        return (
          <group key={floor}>
            {!ghost && (
              <mesh name={`seg-${tower.id}-${floor}`} material={set} position={[0, y, 0]} castShadow receiveShadow>
                <boxGeometry args={[stemW, FH, bodyD]} />
              </mesh>
            )}
            {!ghost && isCross && (
              <mesh name={`arm-${tower.id}-${floor}`} material={set} position={[0, y, 0]} castShadow receiveShadow>
                <boxGeometry args={[bodyW, FH, armD]} />
              </mesh>
            )}
            {!ghost && (
              <mesh position={[0, y - FH / 2 + 0.08, 0]} castShadow receiveShadow>
                <boxGeometry args={[w + 0.6, 0.16, d + 0.6]} />
                <meshStandardMaterial color="#efe8dc" roughness={0.82} />
              </mesh>
            )}
            {!ghost && [1, -1].map((s) =>
              Array.from({ length: bay }, (_, i) => {
                const z = -d / 2 + ((i + 0.5) * d) / bay;
                const span = d / bay - 0.55;
                return (
                  <group key={`x-${s}-${i}`}>
                    <mesh position={[s * (w / 2 + 0.85), y - FH / 2 + 0.12, z]} castShadow receiveShadow>
                      <boxGeometry args={[1.7, 0.14, span]} />
                      <meshStandardMaterial color="#f3eee4" roughness={0.78} />
                    </mesh>
                    <mesh position={[s * (w / 2 + 1.62), y - 0.15, z]}>
                      <boxGeometry args={[0.05, 1.15, span - 0.15]} />
                      <primitive object={railGlass} attach="material" />
                    </mesh>
                    <mesh position={[s * (w / 2 + 1.62), y + 0.42, z]}>
                      <boxGeometry args={[0.06, 0.05, span - 0.15]} />
                      <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.35} />
                    </mesh>
                  </group>
                );
              }),
            )}
            {!ghost && isCross && [1, -1].map((s) =>
              Array.from({ length: 3 }, (_, i) => {
                const x = -w / 2 + ((i + 0.5) * w) / 3;
                const span = w / 3 - 0.55;
                return (
                  <group key={`z-${s}-${i}`}>
                    <mesh position={[x, y - FH / 2 + 0.12, s * (d / 2 + 0.85)]} castShadow receiveShadow>
                      <boxGeometry args={[span, 0.14, 1.7]} />
                      <meshStandardMaterial color="#f3eee4" roughness={0.78} />
                    </mesh>
                    <mesh position={[x, y - 0.15, s * (d / 2 + 1.62)]}>
                      <boxGeometry args={[span - 0.15, 1.15, 0.05]} />
                      <primitive object={railGlass} attach="material" />
                    </mesh>
                  </group>
                );
              }),
            )}
            {lobby && !ghost && [-1, 1].map((s) => (
              <mesh key={`col-${s}`} position={[s * (w / 2 - 1.4), PODIUM_H + 1.7, 0]} castShadow>
                <boxGeometry args={[0.55, 3.4, 0.55]} />
                <meshStandardMaterial color="#ddd6c8" roughness={0.55} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* ghosted upper floors: one glass volume + edges, so the opened floor stays readable */}
      {showFacade && cutAt !== null && cutAt < levels - 1 && (() => { const h = (levels - 1 - cutAt) * FH; const y = PODIUM_H + (cutAt + 1) * FH + h / 2; const gw = isCross ? w * 0.38 : w; const gd = isCross ? d * 0.38 : d; return (
        <group position={[0, y, 0]}>
          <mesh name="ghost"><boxGeometry args={[gw, h, d]} /><meshStandardMaterial color="#dfe6ee" transparent opacity={0.07} depthWrite={false} roughness={0.2} metalness={0.4} /></mesh>
          {isCross && <mesh name="ghost-arm"><boxGeometry args={[w, h, gd]} /><meshStandardMaterial color="#dfe6ee" transparent opacity={0.07} depthWrite={false} roughness={0.2} metalness={0.4} /></mesh>}
          <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(gw, h, d)]} /><lineBasicMaterial color="#ffffff" transparent opacity={0.35} /></lineSegments>
        </group>); })()}
      {/* roof: typical-floor CAD plate coloured by SFT — the official master-layout look */}
      {phase === 'complete' && cutAt === null && (
        <group position={[0, towerTop(tower), 0]}>
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[w + 0.9, 0.2, d + 0.9]} />
            <meshStandardMaterial color="#e8e2d6" roughness={0.9} />
          </mesh>
          <TowerRoofCad tower={tower} />
          {[
            [0, d / 2 + 0.2, w + 0.7, 0.16],
            [0, -d / 2 - 0.2, w + 0.7, 0.16],
            [w / 2 + 0.2, 0, 0.16, d + 0.7],
            [-w / 2 - 0.2, 0, 0.16, d + 0.7],
          ].map(([x, z, bw, bd], i) => (
            <mesh key={i} position={[x, 0.62, z]} castShadow>
              <boxGeometry args={[bw, 0.95, bd]} />
              <meshStandardMaterial color="#efe6d8" roughness={0.82} />
            </mesh>
          ))}
          <mesh position={[0, 1.35, 0]} castShadow>
            <boxGeometry args={[5.2, 2.4, 4.6]} />
            <meshStandardMaterial color="#e6dfd2" roughness={0.75} />
          </mesh>
        </group>
      )}
      <Html position={[0, towerTop(tower) + 12, 0]} center zIndexRange={[20, 0]}>
        <TowerLabel tower={tower} selected={selected} />
      </Html>
    </group>
  );
}
function TowerLabel({ tower, selected }: { tower: Tower; selected: boolean }) {
  const statuses = useAppStore((s) => s.statuses);
  const selectTower = useAppStore((s) => s.selectTower);
  const setRightOpen = useAppStore((s) => s.setRightOpen);
  const avail = project.flats.filter((f) => f.tower === tower.id && statuses[f.id] === 'available').length;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); selectTower(tower.id); setRightOpen(true); }}
      className={`label-float pointer-events-auto select-none whitespace-nowrap rounded-lg border px-3 py-1.5 text-center shadow-glow backdrop-blur-md ${selected ? 'border-white bg-white text-black' : 'border-white/20 bg-black/65 text-white hover:border-white/50'}`}
    >
      <div className="text-[12px] font-bold tracking-[0.2em]">{tower.name.toUpperCase()}</div>
      <div className={`text-[9px] tracking-[0.15em] ${selected ? 'text-neutral-600' : 'text-neutral-300'}`}>{avail} AVAILABLE · {project.project.configuration}</div>
    </button>
  );
}

/* ================================================================== */
/* Floor cut-away: plan plate on the opened floor + unit pills         */
/* ================================================================== */
function makePlanTexture(flats: Flat[], statuses: Record<string, string>, selectedId: string | null, shape: PlateShape) {
  const { canvas } = makeFloorCanvas(flats, selectedId, statuses, shape);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t;
}
function FloorCutaway() {
  const towerId = useAppStore((s) => s.selectedTower); const floor = useAppStore((s) => s.selectedFloor);
  const flatId = useAppStore((s) => s.selectedFlatId); const statuses = useAppStore((s) => s.statuses); const selectFlat = useAppStore((s) => s.selectFlat);
  const flats = useMemo(() => (towerId && floor !== null ? project.flats.filter((f) => f.tower === towerId && f.floor === floor) : []), [towerId, floor]);
  const shape = towerId ? towerShape(towerById(towerId)) : 'bar';
  const plan = useMemo(() => (flats.length ? makePlanTexture(flats, statuses, flatId, shape) : null), [flats, statuses, flatId, shape]);
  const slots = useMemo(() => (flats.length && towerId ? plateSlots3D(flats, towerById(towerId).footprint, shape) : []), [flats, towerId, shape]);
  useEffect(() => () => { plan?.dispose(); }, [plan]);
  if (!towerId || floor === null) return null;
  const t = towerById(towerId); const [w, d] = t.footprint;
  const yTop = PODIUM_H + (floor + 1) * FH + 0.02;
  return (
    <group position={[t.position[0], 0, t.position[1]]} rotation={[0, -deg(t.rotation), 0]}>
      <mesh name="plan-plate" position={[0, yTop + 0.12, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} renderOrder={5}>
        <planeGeometry args={[d, w]} />
        {plan ? <meshBasicMaterial map={plan} toneMapped={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} /> : <meshBasicMaterial color="#f3efe6" polygonOffset polygonOffsetFactor={-4} />}
      </mesh>
      <mesh position={[0, PODIUM_H + floor * FH + FH / 2, 0]}>
        <boxGeometry args={[w + 0.4, FH, d + 0.4]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {slots.map((slot) => {
        const f = slot.flat as Flat;
        const sel = flatId === f.id;
        return (
          <group key={f.id}>
            <Select enabled={sel}>
              <mesh position={[slot.lx, yTop + 0.28, slot.lz]} onClick={(e) => { e.stopPropagation(); selectFlat(f.id); }}>
                <boxGeometry args={[Math.max(slot.pd - 0.35, 1.2), 0.16, Math.max(slot.pw - 0.35, 1.2)]} />
                <meshStandardMaterial color={sel ? ACCENT : new THREE.Color(SFT_COLOR[f.sqft] ?? '#d8d2c4')} emissive={sel ? ACCENT : BLACK} emissiveIntensity={sel ? 0.35 : 0} transparent opacity={sel ? 0.22 : 0.02} depthWrite={false} />
              </mesh>
            </Select>
            <Html position={[slot.lx + slot.side * (w / 4 + 2.2), yTop + 1.15, slot.lz]} center zIndexRange={[18, 0]}>
              <button onClick={() => selectFlat(f.id)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] shadow-glow backdrop-blur ${sel ? 'border-[#c4a057] bg-[#c4a057] text-black' : 'border-white/25 bg-black/70 text-white hover:bg-black'}`}>
                <span className="h-2 w-2 rounded-[2px]" style={{ background: SFT_COLOR[f.sqft] }} />
                {f.flatNo} · {f.sqft}
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[statuses[f.id]] ?? STATUS_COLOR[statuses[f.id]] }} />
              </button>
            </Html>
          </group>
        );
      })}
      <CompassBadges tower={t} yTop={yTop} peers={flats} />
    </group>
  );
}
function CompassBadges({ tower, yTop, peers }: { tower: Tower; yTop: number; peers: Flat[] }) {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const flat = project.flats.find((f) => f.id === flatId); if (!flat) return null;
  const { lx, lz } = slotForFlat(tower, flat, peers);
  const r = deg(tower.rotation); // world directions expressed in tower-local frame
  const world: Record<Flat['facing'], [number, number]> = { North: [0, -1], East: [1, 0], West: [-1, 0], South: [0, 1] };
  return (
    <group>
      {(Object.keys(world) as Flat['facing'][]).map((k) => {
        const [wx, wz] = world[k]; const dx = wx * Math.cos(r) - wz * Math.sin(r), dz = wx * Math.sin(r) + wz * Math.cos(r);
        return (
          <Html key={k} position={[lx + dx * 7, yTop + 3, lz + dz * 7]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold shadow-glow ${k === flat.facing ? 'border-accent bg-accent text-white' : 'border-white/30 bg-black/70 text-white/80'}`}>{k[0]}</div>
          </Html>
        );
      })}
      <Html position={[lx, yTop + 6, lz]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full bg-[#c4a057] px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-black shadow-glow">{flat.id} · {flat.bhk} BHK · {flat.sqft} SFT · {flat.facing.toUpperCase()}</div>
      </Html>
    </group>
  );
}

/* ================================================================== */
/* Optional glTF (meshes T1_F12_01)                                     */
/* ================================================================== */
function GltfTowers({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  const selectedFlat = useAppStore((s) => s.selectedFlatId); const selectedFloor = useAppStore((s) => s.selectedFloor); const selectedTower = useAppStore((s) => s.selectedTower); const selectTower = useAppStore((s) => s.selectTower);
  useEffect(() => {
    scene.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const match = /^([A-Z]\d?)_F(\d+)_(\d+)$/.exec(m.name); const mat = m.material as THREE.MeshStandardMaterial; if (!match || !mat?.emissive) return; const [, t, f, n] = match; const id = `${t}-${f.padStart(2, '0')}${n.padStart(2, '0')}`; const isFlat = selectedFlat === id, isFloor = !selectedFlat && selectedTower === t && selectedFloor === Number(f); mat.emissive.copy(isFlat || isFloor ? ACCENT : BLACK); mat.emissiveIntensity = isFlat ? 1.4 : isFloor ? 0.7 : 0; });
  }, [scene, selectedFlat, selectedFloor, selectedTower]);
  return <primitive object={scene} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const t = /^([A-Z]\d?)_/.exec(e.object.name)?.[1]; if (t) selectTower(t); }} />;
}

/* ================================================================== */
/* Camera                                                              */
/* ================================================================== */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const INSTANT = typeof location !== 'undefined' && location.search.includes('instant'); // QA: skip camera animation
function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null); const { camera } = useThree();
  const goal = useCam((s) => s.goal); const nonce = useCam((s) => s.nonce); const setAzimuth = useCam((s) => s.setAzimuth);
  const selectedTower = useAppStore((s) => s.selectedTower);
  const anim = useRef<{ from: CamGoal; to: CamGoal; start: number } | null>(null); const lastInteraction = useRef(performance.now()); const tick = useRef(0);
  useEffect(() => { if (!goal || !controls.current) return; if (INSTANT) { camera.position.copy(goal.pos); controls.current.target.copy(goal.target); controls.current.update(); return; } anim.current = { from: { pos: camera.position.clone(), target: controls.current.target.clone() }, to: goal, start: performance.now() }; }, [nonce, goal, camera]);
  useEffect(() => { const c = controls.current; if (!c) return; c.target.copy(BIRD_EYE.target); c.update(); const onStart = () => { anim.current = null; lastInteraction.current = performance.now(); }; c.addEventListener('start', onStart); return () => c.removeEventListener('start', onStart); }, []);
  useFrame(() => { const c = controls.current; if (!c) return; if (anim.current) { const { from, to, start } = anim.current; const t = Math.min(1, (performance.now() - start) / 1200); const k = easeOutCubic(t); camera.position.lerpVectors(from.pos, to.pos, k); c.target.lerpVectors(from.target, to.target, k); if (t >= 1) anim.current = null; } c.autoRotate = !selectedTower && performance.now() - lastInteraction.current > 8000; c.update(); if (++tick.current % 6 === 0) setAzimuth(c.getAzimuthalAngle()); });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.06} minPolarAngle={0.2} maxPolarAngle={1.4} minDistance={18} maxDistance={1400} autoRotateSpeed={0.3} />;
}
function useSelectionFly() {
  const fly = useCam((s) => s.fly);
  const selectedTower = useAppStore((s) => s.selectedTower); const selectedFloor = useAppStore((s) => s.selectedFloor); const selectedFlat = useAppStore((s) => s.selectedFlatId); const module = useAppStore((s) => s.module);
  useEffect(() => {
    if ((module !== 'master' && module !== 'towers') || !selectedTower) return;
    const t = towerById(selectedTower); const base = new THREE.Vector3(t.position[0], 0, t.position[1]);
    const flat = project.flats.find((f) => f.id === selectedFlat);
    if (flat) { const { lx, lz, side } = slotForFlat(t, flat); const yTop = PODIUM_H + (flat.floor + 1) * FH; const target = localToWorld(t, lx, lz, yTop); const pos = localToWorld(t, lx + side * 16, lz + 9, yTop + 36); fly({ pos, target }); }
    else if (selectedFloor !== null) { const yTop = PODIUM_H + (selectedFloor + 1) * FH; const target = base.clone().setY(yTop); const pos = localToWorld(t, 26, 22, yTop + 50); fly({ pos, target }); }
    else { const target = base.clone().setY(towerTop(t) / 2); const pos = localToWorld(t, 120, 70, 70); fly({ pos, target }); }
  }, [selectedTower, selectedFloor, selectedFlat, module, fly]);
}

/* ================================================================== */
/* Lighting + scene                                                    */
/* ================================================================== */
function Lighting({ hdrUrl }: { hdrUrl: string | null }) {
  if (hdrUrl) return <Environment files={hdrUrl} environmentIntensity={1.05} />;
  return <Environment preset="sunset" environmentIntensity={0.85} background={false} />;
}
const SUN = new THREE.Vector3(320, 140, 90); // late-afternoon cinematic light, Navigo-style

function Scene({ glbUrl, hdrUrl }: { glbUrl: string | null; hdrUrl: string | null }) {
  useSelectionFly();
  const three = useThree();
  useEffect(() => { (window as unknown as { __three?: unknown }).__three = { scene: three.scene, camera: three.camera, THREE }; }, [three]);
  const tex = useMemo(() => makeFacade(), []);
  return (
    <>
      <fog attach="fog" args={['#c4b39a', 280, 2800]} />
      <Sky distance={45000} sunPosition={SUN.toArray()} turbidity={7.5} rayleigh={0.7} mieCoefficient={0.006} mieDirectionalG={0.86} />
      <ambientLight intensity={0.42} color="#ffe8cf" />
      <hemisphereLight args={['#ffe2c4', '#6a5a48', 0.55]} />
      <directionalLight position={SUN.toArray()} intensity={2.85} color="#ffd7a8" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-220} shadow-camera-right={220} shadow-camera-top={220} shadow-camera-bottom={-220} shadow-camera-near={10} shadow-camera-far={900} shadow-bias={-0.0003} />
      <Quiet><Suspense fallback={null}><Lighting hdrUrl={hdrUrl} /></Suspense></Quiet>
      <Selection>
        <EffectComposer autoClear={false} multisampling={0}>
          <Outline blur edgeStrength={8} width={1600} visibleEdgeColor={0xc4a057} hiddenEdgeColor={0x8a7040} xRay={false} />
        </EffectComposer>
        <group>
          <SatelliteGround />
          <Quiet><OsmBuildings /></Quiet>
          <Podium />
          {glbUrl ? <Suspense fallback={project.towers.map((t) => <TowerBlock key={t.id} tower={t} tex={tex} />)}><GltfTowers url={glbUrl} /></Suspense> : project.towers.map((t) => <TowerBlock key={t.id} tower={t} tex={tex} />)}
          <FloorCutaway />
        </group>
      </Selection>
      <CameraRig />
    </>
  );
}

/* ================================================================== */
/* DOM overlays                                                        */
/* ================================================================== */
function Overlays() {
  const az = useCam((s) => s.azimuth); const fly = useCam((s) => s.fly); const setLeadOpen = useAppStore((s) => s.setLeadOpen);
  const selectedFloor = useAppStore((s) => s.selectedFloor); const selectFloor = useAppStore((s) => s.selectFloor);
  const phase = useAppStore((s) => s.constructionPhase); const setPhase = useAppStore((s) => s.setConstructionPhase);
  const [view, setView] = useState<'bird' | 'elev'>('bird');
  const go = (v: 'bird' | 'elev') => { setView(v); selectFloor(null); fly(v === 'bird' ? BIRD_EYE : ELEVATION); };
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-20 z-20 flex flex-col items-center gap-1 sm:left-5">
        <div className="glass grid h-12 w-12 place-items-center rounded-full" style={{ transform: `rotate(${(az * 180) / Math.PI}deg)` }}>
          <svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2l4 10-4-2-4 2z" fill="#c4a057" /><path d="M12 22l-4-10 4 2 4-2z" fill="#ffffff" fillOpacity="0.6" /></svg>
        </div>
        <span className="text-[9px] font-bold tracking-[0.25em] text-white/80">N</span>
      </div>
      <button onClick={() => setLeadOpen(true)} className="glass absolute left-4 top-[152px] z-20 rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.2em] text-white hover:bg-white hover:text-black sm:left-5">SEND BROCHURE</button>
      <div className="glass absolute left-4 top-[196px] z-20 w-[min(330px,calc(100vw-2rem))] rounded-2xl p-2 sm:left-5">
        <div className="mb-1.5 flex items-center justify-between px-1 text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400"><span>Construction layers</span><span>{phase}</span></div>
        <div className="grid grid-cols-5 gap-1">
          {(['foundation', 'pillars', 'structure', 'facade', 'complete'] as ConstructionPhase[]).map((item, index) => (
            <button key={item} onClick={() => setPhase(item)} title={item} className={`rounded-lg px-1 py-2 text-[9px] font-bold uppercase tracking-wide ${phase === item ? 'bg-white text-black' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}`}>
              <span className="block text-[11px]">{index + 1}</span>{item === 'foundation' ? 'Base' : item === 'structure' ? 'Slabs' : item}
            </button>
          ))}
        </div>
      </div>
      <div className="absolute bottom-24 right-4 z-20 flex gap-1 sm:right-5">
        {selectedFloor !== null && <button onClick={() => selectFloor(null)} className="glass rounded-full px-3.5 py-2 text-[10px] font-bold tracking-[0.18em] text-white hover:bg-white hover:text-black">CLOSE FLOOR</button>}
        <div className="glass flex gap-1 rounded-full p-1">
          {([['bird', 'BIRD EYE VIEW'], ['elev', 'ELEVATION']] as const).map(([k, l]) => (
            <button key={k} onClick={() => go(k)} className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-[0.18em] transition ${view === k ? 'bg-white text-black' : 'text-neutral-300 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-24 left-4 z-20 hidden max-w-sm sm:left-5 md:block">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/80 drop-shadow">Master plan · {project.project.landArea} · {project.project.configuration}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight drop-shadow-lg">{project.project.name}</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-white/85 drop-shadow">{project.project.tagline} Tap a tower, then a floor — the plate is coloured by SFT, the way the builder printed it.</p>
        <div className="pointer-events-auto mt-3"><SftLegend /></div>
      </div>
    </>
  );
}

export default function MasterPlanCanvas() {
  const selectTower = useAppStore((s) => s.selectTower); const selectedFlat = useAppStore((s) => s.selectedFlatId);
  const [glbUrl, setGlbUrl] = useState<string | null>(null); const [hdrUrl, setHdrUrl] = useState<string | null>(null);
  useEffect(() => {
    const glb = assetUrl('/models/towers.glb'); fetch(glb, { method: 'HEAD' }).then((r) => { if (r.ok && (r.headers.get('content-type') ?? '').includes('model')) setGlbUrl(glb); }).catch(() => {});
    const hdr = assetUrl('/hdri/sky.hdr'); fetch(hdr, { method: 'HEAD' }).then((r) => { if (r.ok && !(r.headers.get('content-type') ?? '').includes('html')) setHdrUrl(hdr); }).catch(() => {});
  }, []);
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: BIRD_EYE.pos.toArray(), fov: 40, near: 1, far: 60000 }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12, logarithmicDepthBuffer: true }}
        onCreated={({ gl }) => lockCanvasScroll(gl.domElement)}
        onPointerMissed={(e) => { if (e.type === 'click' && !selectedFlat) selectTower(null); }}>
        <Suspense fallback={<Html center><div className="shimmer h-24 w-56 rounded-2xl" /></Html>}><Scene glbUrl={glbUrl} hdrUrl={hdrUrl} /></Suspense>
      </Canvas>
      <Overlays />
    </div>
  );
}
