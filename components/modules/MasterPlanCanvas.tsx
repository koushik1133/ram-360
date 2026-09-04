'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, Html, Sky, useGLTF } from '@react-three/drei';
import { EffectComposer, Outline, Selection, Select } from '@react-three/postprocessing';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { create } from 'zustand';
import { useAppStore } from '@/store/useAppStore';
import { project, assetUrl, STATUS_COLOR } from '@/lib/data';
import type { Flat, Tower } from '@/lib/types';

/* ================================================================== */
/* Scene constants — 1 unit = 1 metre, origin = site centre            */
/* ================================================================== */
const FH = project.project.floorHeight; // 3.1 m
const PODIUM_H = 4; // podium deck height (basement + stilt)
const [CLNG, CLAT] = project.project.center;
const ACCENT = new THREE.Color('#3B82F6');
const BLACK = new THREE.Color('#000000');
const deg = (d: number) => (d * Math.PI) / 180;
const towerById = (id: string) => project.towers.find((t) => t.id === id)!;
const towerLevels = (t: Tower) => t.floors + 1; // G + N
const towerTop = (t: Tower) => PODIUM_H + towerLevels(t) * FH;
/** tower-local (x, z) → world, honouring the row tilt */
const localToWorld = (t: Tower, lx: number, lz: number, y = 0) => {
  const r = deg(t.rotation); const c = Math.cos(r), s = Math.sin(r);
  return new THREE.Vector3(t.position[0] + lx * c + lz * s, y, t.position[1] - lx * s + lz * c);
};
const towerDir = (t: Tower, lx: number, lz: number) => localToWorld(t, lx, lz).sub(new THREE.Vector3(t.position[0], 0, t.position[1])).normalize();
/** unit centre in tower-local coords: 01–05 along +x (east) face, 06–10 along −x (west) face */
const flatLocal = (t: Tower, idx: number) => {
  const [w, d] = t.footprint; const side = idx < 5 ? 1 : -1; const k = idx % 5;
  return { lx: (side * w) / 4, lz: -d / 2 + ((k + 0.5) * d) / 5, side };
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
  const bays = 4, BW = 128, W = BW * bays, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d')!;
  const e = document.createElement('canvas'); e.width = W; e.height = H; const ectx = e.getContext('2d')!;
  ctx.fillStyle = '#e3e1dc'; ctx.fillRect(0, 0, W, H);
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.02)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  for (let b = 0; b < bays; b++) {
    const x = b * BW;
    // floor slab band (bottom)
    ctx.fillStyle = '#d2cfc8'; ctx.fillRect(x, H - 12, BW, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, H - 14, BW, 3);
    // window: dark glass with sky sheen + frame
    const g = ctx.createLinearGradient(0, 22, 0, 84); g.addColorStop(0, '#7c95ad'); g.addColorStop(0.4, '#22323f'); g.addColorStop(1, '#0f171f');
    ctx.fillStyle = '#f2f1ee'; ctx.fillRect(x + 22, 18, 84, 70);
    ctx.fillStyle = g; ctx.fillRect(x + 26, 22, 36, 62); ctx.fillRect(x + 66, 22, 36, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 26, 22, 36, 8); ctx.fillRect(x + 66, 22, 36, 8);
    // balcony railing (MS rail) drawn over lower window third
    ctx.strokeStyle = 'rgba(45,45,45,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 10, 96); ctx.lineTo(x + BW - 10, 96); ctx.stroke();
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x + 12 + i * 9, 96); ctx.lineTo(x + 12 + i * 9, 114); ctx.stroke(); }
    // shadow line under slab
    ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(x, 0, BW, 4);
    if (Math.random() < 0.25) { ectx.fillStyle = 'rgba(255,205,140,0.9)'; ectx.fillRect(x + 26, 24, 36, 58); }
    if (Math.random() < 0.2) { ectx.fillStyle = 'rgba(255,220,170,0.85)'; ectx.fillRect(x + 66, 24, 36, 58); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const emissive = new THREE.CanvasTexture(e); emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  return { map, emissive, bayWidth: 3.6 };
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
  if (geom) return <mesh geometry={geom} castShadow receiveShadow><meshStandardMaterial color="#d8d3ca" roughness={0.95} /></mesh>;
  if (!failed) return null;
  return <group>{Array.from({ length: 120 }, (_, i) => { const a = (i / 120) * Math.PI * 2, r = 160 + (i % 7) * 40, h = 8 + (i % 5) * 4; return <mesh key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} castShadow receiveShadow><boxGeometry args={[12, h, 12]} /><meshStandardMaterial color="#cfc8be" /></mesh>; })}</group>;
}

/* ================================================================== */
/* Podium, landscape, boundary, trees                                  */
/* ================================================================== */
function Tree({ position, scale = 1, seed = 0 }: { position: [number, number, number]; scale?: number; seed?: number }) {
  const greens = ['#3d7a35', '#4a8a3c', '#2f6a2c', '#5a9a44'];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 2.8, 7]} /><meshStandardMaterial color="#5b4634" roughness={1} /></mesh>
      <mesh position={[0, 3.4, 0]} castShadow><sphereGeometry args={[1.5, 9, 7]} /><meshStandardMaterial color={greens[seed % 4]} roughness={1} /></mesh>
      <mesh position={[0.7, 4.1, 0.3]} castShadow><sphereGeometry args={[1.1, 8, 6]} /><meshStandardMaterial color={greens[(seed + 1) % 4]} roughness={1} /></mesh>
      <mesh position={[-0.6, 4.3, -0.4]} castShadow><sphereGeometry args={[1.0, 8, 6]} /><meshStandardMaterial color={greens[(seed + 2) % 4]} roughness={1} /></mesh>
    </group>
  );
}
function Podium() {
  const t0 = project.towers[0];
  const rot = deg(t0.rotation);
  const trees = useMemo(() => {
    let seed = 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const list: { p: [number, number, number]; s: number; k: number }[] = [];
    // east lawn strip and west drive edge, in row-local coords then rotated
    for (let i = 0; i < 70; i++) { const lx = 34 + rnd() * 18, lz = -78 + rnd() * 156; const v = new THREE.Vector3(lx * Math.cos(rot) + lz * Math.sin(rot), PODIUM_H, -lx * Math.sin(rot) + lz * Math.cos(rot)); list.push({ p: [v.x, v.y, v.z], s: 0.9 + rnd() * 0.8, k: i }); }
    for (let i = 0; i < 40; i++) { const lx = -48 + rnd() * 10, lz = -78 + rnd() * 156; const v = new THREE.Vector3(lx * Math.cos(rot) + lz * Math.sin(rot), PODIUM_H, -lx * Math.sin(rot) + lz * Math.cos(rot)); list.push({ p: [v.x, v.y, v.z], s: 0.8 + rnd() * 0.7, k: i + 70 }); }
    return list;
  }, [rot]);
  return (
    <group rotation={[0, -rot, 0]}>
      {/* podium deck */}
      <mesh position={[0, PODIUM_H / 2, 0]} receiveShadow castShadow><boxGeometry args={[120, PODIUM_H, 176]} /><meshStandardMaterial color="#c9c4bb" roughness={0.95} /></mesh>
      {/* east landscaped garden + amphitheatre lawn */}
      <mesh position={[42, PODIUM_H + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[26, 160]} /><meshStandardMaterial color="#4f8a3a" roughness={1} /></mesh>
      {/* swimming pool (clubhouse terrace) */}
      <mesh position={[40, PODIUM_H + 0.08, -66]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[14, 26]} /><meshStandardMaterial color="#2f9bd6" roughness={0.1} metalness={0.3} /></mesh>
      <mesh position={[40, PODIUM_H + 0.05, -66]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[17, 29]} /><meshStandardMaterial color="#e8e4dc" /></mesh>
      {/* tennis + basketball courts */}
      <mesh position={[42, PODIUM_H + 0.07, 62]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[18, 34]} /><meshStandardMaterial color="#2e5f3d" roughness={1} /></mesh>
      <mesh position={[42, PODIUM_H + 0.07, 62]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[8.6, 9, 4]} /><meshStandardMaterial color="#f5f5f5" side={THREE.DoubleSide} /></mesh>
      {/* driveway ring (west) + entrance plaza */}
      <mesh position={[-46, PODIUM_H + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[8, 170]} /><meshStandardMaterial color="#5d5d5a" roughness={1} /></mesh>
      <mesh position={[-52, PODIUM_H + 0.05, -60]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, 24]} /><meshStandardMaterial color="#b9b3a8" roughness={1} /></mesh>
      {/* boundary wall with solar fencing */}
      {[[0, -88, 120, 1], [0, 88, 120, 1], [-60, 0, 1, 176], [60, 0, 1, 176]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, PODIUM_H + 1.1, z]} castShadow><boxGeometry args={[w, 2.2, d]} /><meshStandardMaterial color="#bdb7ac" roughness={1} /></mesh>
      ))}
      {/* clubhouse block */}
      <mesh position={[40, PODIUM_H + 5, -30]} castShadow receiveShadow><boxGeometry args={[22, 10, 30]} /><meshStandardMaterial color="#e7e4de" roughness={0.8} /></mesh>
      <mesh position={[40, PODIUM_H + 10.4, -30]} castShadow><boxGeometry args={[23, 0.8, 31]} /><meshStandardMaterial color="#f2f0ea" /></mesh>
      {/* parked cars along the drive */}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[-42.5, PODIUM_H + 0.8, -70 + i * 11]} castShadow><boxGeometry args={[2, 1.5, 4.4]} /><meshStandardMaterial color={['#dcdcdc', '#1f1f1f', '#8a8f96', '#b8232f'][i % 4]} metalness={0.6} roughness={0.35} /></mesh>
      ))}
      {trees.map((t) => <group key={t.k} rotation={[0, rot, 0]}><Tree position={[t.p[0] * Math.cos(rot) - t.p[2] * Math.sin(rot), t.p[1], t.p[0] * Math.sin(rot) + t.p[2] * Math.cos(rot)]} scale={t.s} seed={t.k} /></group>)}
    </group>
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
  const cutAt = anySelected && selectedFloor !== null ? selectedFloor : null; // slice every tower at the opened floor
  const [w, d] = tower.footprint; const levels = towerLevels(tower);

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
      const mm = m as THREE.MeshStandardMaterial; mm.emissiveIntensity = mm.emissiveMap ? 0.5 + (hovered && !selected ? 0.15 : 0) : 0;
    }));
  }, [mats, cutAt, hovered, selected]);

  return (
    <group position={[tower.position[0], 0, tower.position[1]]} rotation={[0, -deg(tower.rotation), 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(tower.id); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(null); document.body.style.cursor = 'auto'; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); selectTower(tower.id); setRightOpen(true); }}
    >
      {mats.map((set, floor) => {
        const y = PODIUM_H + floor * FH + FH / 2; const ghost = cutAt !== null && floor > cutAt;
        return (
          <group key={floor}>
            {!ghost && <mesh name={`seg-${tower.id}-${floor}`} material={set} position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[w, FH, d]} /></mesh>}
            {/* balcony slabs on both long faces */}
            {!ghost && [1, -1].map((s) => (
              <group key={s}>
                <mesh position={[s * (w / 2 + 0.7), y - FH / 2 + 0.1, 0]} castShadow receiveShadow><boxGeometry args={[1.5, 0.2, d - 2]} /><meshStandardMaterial color="#efece6" roughness={0.9} /></mesh>
                <mesh position={[s * (w / 2 + 1.4), y - FH / 2 + 0.7, 0]}><boxGeometry args={[0.06, 1.1, d - 2]} /><meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} transparent opacity={0.75} /></mesh>
              </group>
            ))}
          </group>
        );
      })}
      {/* ghosted upper floors: one glass volume + edges, so the opened floor stays readable */}
      {cutAt !== null && cutAt < levels - 1 && (() => { const h = (levels - 1 - cutAt) * FH; const y = PODIUM_H + (cutAt + 1) * FH + h / 2; return (
        <group position={[0, y, 0]}>
          <mesh name="ghost"><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#dfe6ee" transparent opacity={0.07} depthWrite={false} roughness={0.2} metalness={0.4} /></mesh>
          <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} /><lineBasicMaterial color="#ffffff" transparent opacity={0.35} /></lineSegments>
        </group>); })()}
      {/* roof: parapet + pergola frame + lift machine room */}
      {cutAt === null && (
        <group position={[0, towerTop(tower), 0]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow><boxGeometry args={[w + 1.6, 0.6, d + 1.6]} /><meshStandardMaterial color="#f0ede7" roughness={0.9} /></mesh>
          <mesh position={[0, 1.6, 0]}><boxGeometry args={[w + 1.4, 2.0, 0.25]} /><meshStandardMaterial color="#f0ede7" /></mesh>
          <mesh position={[0, 3.6, 0]} castShadow><boxGeometry args={[w + 1.4, 0.35, d + 1.4]} /><meshStandardMaterial color="#f4f2ec" /></mesh>
          {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[-w / 2 + (i * w) / 4, 2, 0]} castShadow><boxGeometry args={[0.35, 3.2, d + 1.2]} /><meshStandardMaterial color="#f4f2ec" /></mesh>)}
          <mesh position={[0, 2.2, 0]} castShadow><boxGeometry args={[7, 4.4, 7]} /><meshStandardMaterial color="#e2dfd8" /></mesh>
        </group>
      )}
      <Html position={[0, towerTop(tower) + 12, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <TowerLabel tower={tower} selected={selected} />
      </Html>
    </group>
  );
}
function TowerLabel({ tower, selected }: { tower: Tower; selected: boolean }) {
  const statuses = useAppStore((s) => s.statuses);
  const avail = project.flats.filter((f) => f.tower === tower.id && statuses[f.id] === 'available').length;
  return (
    <div className={`label-float select-none whitespace-nowrap rounded-lg border px-3 py-1.5 text-center shadow-glow backdrop-blur-md ${selected ? 'border-white bg-white text-black' : 'border-white/20 bg-black/65 text-white'}`}>
      <div className="text-[12px] font-bold tracking-[0.2em]">{tower.name.toUpperCase()}</div>
      <div className={`text-[9px] tracking-[0.15em] ${selected ? 'text-neutral-600' : 'text-neutral-300'}`}>{avail} AVAILABLE · {project.project.configuration}</div>
    </div>
  );
}

/* ================================================================== */
/* Floor cut-away: plan plate on the opened floor + unit pills         */
/* ================================================================== */
/** Procedural floor-plate texture: corridor, 10 units, furniture hints, live status tint. 1600×1000 = tower long axis × depth. */
function makePlanTexture(flats: Flat[], statuses: Record<string, string>, selectedId: string | null) {
  const W = 1600, H = 1000, UW = 300, UH = 400;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b9b3a8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8f8a80'; ctx.fillRect(50, 440, 1500, 120); // corridor
  ctx.fillStyle = '#6e6960'; ctx.fillRect(50, 440, 120, 120); ctx.fillRect(1430, 440, 120, 120); // cores
  ctx.fillStyle = '#f5f5f5'; ctx.font = 'bold 20px Inter, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LIFT LOBBY', 110, 505); ctx.fillText('LIFT LOBBY', 1490, 505); ctx.fillText('CORRIDOR', 800, 505);
  const tint: Record<string, string> = { available: '#7fd39a', sold: '#ef8f8f', reserved: '#f2d270' };
  flats.forEach((f) => {
    const i = Number(f.flatNo) - 1; const col = i % 5; const east = i < 5;
    const x = 50 + col * UW, y = east ? 40 : 560; const sel = f.id === selectedId;
    ctx.fillStyle = sel ? '#5b9cff' : tint[statuses[f.id]] ?? '#e8e8e8'; ctx.fillRect(x, y, UW, UH);
    ctx.strokeStyle = sel ? '#1d4ed8' : '#2b2b2b'; ctx.lineWidth = sel ? 14 : 8; ctx.strokeRect(x + 4, y + 4, UW - 8, UH - 8);
    // internal partitions (bedrooms / living / kitchen / bath) mirrored for the west row
    const m = (v: number) => (east ? y + v : y + UH - v);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + 140, m(0)); ctx.lineTo(x + 140, m(250)); ctx.moveTo(x, m(250)); ctx.lineTo(x + UW, m(250)); ctx.moveTo(x + 140, m(130)); ctx.lineTo(x, m(130)); ctx.moveTo(x + 80, m(250)); ctx.lineTo(x + 80, m(340)); ctx.stroke();
    // balcony strip on the outer face
    ctx.fillStyle = 'rgba(30,60,110,0.35)'; ctx.fillRect(x + 6, m(east ? 350 : 400) , UW - 12, east ? 44 : 50);
    // furniture hints
    ctx.strokeStyle = '#3f3f3f'; ctx.lineWidth = 3;
    ctx.strokeRect(x + 30, m(east ? 20 : 120), 80, 100); ctx.strokeRect(x + 170, m(east ? 40 : 220), 100, 180); ctx.strokeRect(x + 20, m(east ? 150 : 240), 100, 90); ctx.beginPath(); ctx.arc(x + 220, m(300), 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = sel ? '#ffffff' : '#111111'; ctx.font = 'bold 44px Inter, Arial, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${f.flatNo}`, x + 16, east ? y + UH - 70 : y + 60);
    ctx.font = '700 22px Inter, Arial, sans-serif'; ctx.fillStyle = sel ? '#e8f0ff' : '#222222';
    ctx.fillText(`${f.bhk} BHK · ${f.sqft} sqft`, x + 16, east ? y + UH - 36 : y + 92);
    ctx.fillStyle = STATUS_COLOR[statuses[f.id]] ?? '#999'; ctx.beginPath(); ctx.arc(x + UW - 30, east ? y + UH - 30 : y + 30, 14, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function FloorCutaway() {
  const towerId = useAppStore((s) => s.selectedTower); const floor = useAppStore((s) => s.selectedFloor);
  const flatId = useAppStore((s) => s.selectedFlatId); const statuses = useAppStore((s) => s.statuses); const selectFlat = useAppStore((s) => s.selectFlat);
  const flats = useMemo(() => (towerId && floor !== null ? project.flats.filter((f) => f.tower === towerId && f.floor === floor) : []), [towerId, floor]);
  const plan = useMemo(() => (flats.length ? makePlanTexture(flats, statuses, flatId) : null), [flats, statuses, flatId]);
  useEffect(() => () => { plan?.dispose(); }, [plan]);
  if (!towerId || floor === null) return null;
  const t = towerById(towerId); const [w, d] = t.footprint;
  const yTop = PODIUM_H + (floor + 1) * FH + 0.02;
  return (
    <group position={[t.position[0], 0, t.position[1]]} rotation={[0, -deg(t.rotation), 0]}>
      {/* plan plate: SVG long axis (1600) runs along the tower's long axis (z) */}
      <mesh name="plan-plate" position={[0, yTop + 0.12, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} renderOrder={5}>
        <planeGeometry args={[d, w]} />
        {plan ? <meshBasicMaterial map={plan} toneMapped={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} /> : <meshBasicMaterial color="#151515" polygonOffset polygonOffsetFactor={-4} />}
      </mesh>
      {/* glowing floor outline */}
      <mesh position={[0, PODIUM_H + floor * FH + FH / 2, 0]}>
        <boxGeometry args={[w + 0.4, FH, d + 0.4]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {flats.map((f) => {
        const idx = Number(f.flatNo) - 1; const { lx, lz, side } = flatLocal(t, idx); const sel = flatId === f.id;
        return (
          <group key={f.id}>
            <Select enabled={sel}>
              <mesh position={[lx, yTop + 0.3, lz]} onClick={(e) => { e.stopPropagation(); selectFlat(f.id); }}>
                <boxGeometry args={[w / 2 - 0.6, 0.5, d / 5 - 0.5]} />
                <meshStandardMaterial color={sel ? ACCENT : new THREE.Color(STATUS_COLOR[statuses[f.id]])} emissive={sel ? ACCENT : BLACK} emissiveIntensity={sel ? 0.9 : 0} transparent opacity={sel ? 0.55 : 0.28} depthWrite={false} />
              </mesh>
            </Select>
            <Html position={[lx + side * (w / 4 + 2.5), yTop + 1.2, lz]} center zIndexRange={[18, 0]}>
              <button onClick={() => selectFlat(f.id)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] shadow-glow backdrop-blur ${sel ? 'border-accent bg-accent text-white' : 'border-white/30 bg-black/70 text-white hover:bg-black'}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[statuses[f.id]] }} />{f.flatNo} · {f.bhk}BHK
              </button>
            </Html>
          </group>
        );
      })}
      <CompassBadges tower={t} yTop={yTop} />
    </group>
  );
}
function CompassBadges({ tower, yTop }: { tower: Tower; yTop: number }) {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const flat = project.flats.find((f) => f.id === flatId); if (!flat) return null;
  const { lx, lz } = flatLocal(tower, Number(flat.flatNo) - 1);
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
        <div className="whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-white shadow-glow">{flat.id} · {flat.bhk} BHK · {flat.sqft} SQFT · {flat.facing.toUpperCase()}</div>
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
    if (flat) { const { lx, lz, side } = flatLocal(t, Number(flat.flatNo) - 1); const yTop = PODIUM_H + (flat.floor + 1) * FH; const target = localToWorld(t, lx, lz, yTop); const pos = localToWorld(t, lx + side * 16, lz + 9, yTop + 36); fly({ pos, target }); }
    else if (selectedFloor !== null) { const yTop = PODIUM_H + (selectedFloor + 1) * FH; const target = base.clone().setY(yTop); const pos = localToWorld(t, 26, 22, yTop + 50); fly({ pos, target }); }
    else { const target = base.clone().setY(towerTop(t) / 2); const pos = localToWorld(t, 120, 70, 70); fly({ pos, target }); }
  }, [selectedTower, selectedFloor, selectedFlat, module, fly]);
}

/* ================================================================== */
/* Lighting + scene                                                    */
/* ================================================================== */
function Lighting({ hdrUrl }: { hdrUrl: string | null }) {
  if (hdrUrl) return <Environment files={hdrUrl} environmentIntensity={0.9} />;
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#5b6470']} />
      <Lightformer intensity={3} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[12, 12, 1]} color="#e9f0ff" />
      <Lightformer intensity={1.4} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[20, 2, 1]} color="#dbe7ff" />
      <Lightformer intensity={1.8} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 2, 1]} color="#ffe8cf" />
      <Lightformer intensity={0.8} rotation-x={-Math.PI / 2} position={[0, -4, 0]} scale={[20, 20, 1]} color="#4b4a48" />
    </Environment>
  );
}
const SUN = new THREE.Vector3(260, 300, 180); // early-afternoon sun like the site photo

function Scene({ glbUrl, hdrUrl }: { glbUrl: string | null; hdrUrl: string | null }) {
  useSelectionFly();
  const three = useThree();
  useEffect(() => { (window as unknown as { __three?: unknown }).__three = { scene: three.scene, camera: three.camera, THREE }; }, [three]);
  const tex = useMemo(() => makeFacade(), []);
  return (
    <>
      <fog attach="fog" args={['#cfd6df', 900, 4200]} />
      <Sky distance={45000} sunPosition={SUN.toArray()} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <ambientLight intensity={0.35} color="#eef3ff" />
      <hemisphereLight args={['#dfe9ff', '#5a534c', 0.5]} />
      <directionalLight position={SUN.toArray()} intensity={2.4} color="#fff4e6" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-220} shadow-camera-right={220} shadow-camera-top={220} shadow-camera-bottom={-220} shadow-camera-near={10} shadow-camera-far={900} shadow-bias={-0.0003} />
      <Quiet><Suspense fallback={null}><Lighting hdrUrl={hdrUrl} /></Suspense></Quiet>
      <Selection>
        <EffectComposer autoClear={false} multisampling={0}>
          <Outline blur edgeStrength={10} width={1600} visibleEdgeColor={0x3b82f6} hiddenEdgeColor={0x1d4ed8} xRay={false} />
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
  const [view, setView] = useState<'bird' | 'elev'>('bird');
  const go = (v: 'bird' | 'elev') => { setView(v); selectFloor(null); fly(v === 'bird' ? BIRD_EYE : ELEVATION); };
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-20 z-20 flex flex-col items-center gap-1 sm:left-5">
        <div className="glass grid h-12 w-12 place-items-center rounded-full" style={{ transform: `rotate(${(az * 180) / Math.PI}deg)` }}>
          <svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2l4 10-4-2-4 2z" fill="#3B82F6" /><path d="M12 22l-4-10 4 2 4-2z" fill="#ffffff" fillOpacity="0.6" /></svg>
        </div>
        <span className="text-[9px] font-bold tracking-[0.25em] text-white/80">N</span>
      </div>
      <button onClick={() => setLeadOpen(true)} className="glass absolute left-4 top-[152px] z-20 rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.2em] text-white hover:bg-white hover:text-black sm:left-5">SEND BROCHURE</button>
      <div className="absolute bottom-24 right-4 z-20 flex gap-1 sm:right-5">
        {selectedFloor !== null && <button onClick={() => selectFloor(null)} className="glass rounded-full px-3.5 py-2 text-[10px] font-bold tracking-[0.18em] text-white hover:bg-white hover:text-black">CLOSE FLOOR</button>}
        <div className="glass flex gap-1 rounded-full p-1">
          {([['bird', 'BIRD EYE VIEW'], ['elev', 'ELEVATION']] as const).map(([k, l]) => (
            <button key={k} onClick={() => go(k)} className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-[0.18em] transition ${view === k ? 'bg-white text-black' : 'text-neutral-300 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-24 left-4 z-20 hidden max-w-xs sm:left-5 md:block">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/80 drop-shadow">Master plan · {project.project.landArea} · {project.project.configuration}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight drop-shadow-lg">{project.project.name}</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-white/85 drop-shadow">{project.project.tagline} Tap a tower, then a floor, to open it from the top.</p>
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
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, logarithmicDepthBuffer: true }}
        onPointerMissed={(e) => { if (e.type === 'click' && !selectedFlat) selectTower(null); }}>
        <Suspense fallback={<Html center><div className="shimmer h-24 w-56 rounded-2xl" /></Html>}><Scene glbUrl={glbUrl} hdrUrl={hdrUrl} /></Suspense>
      </Canvas>
      <Overlays />
    </div>
  );
}
