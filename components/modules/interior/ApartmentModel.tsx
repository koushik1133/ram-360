'use client';
/**
 * The furnished apartment. One geometry set, two presentations:
 *   mode="doll" - walls cut at 1.5 m for the top-down digital twin
 *   mode="walk" - full-height walls, ceiling and glazing for the 360 walkthrough
 */
import { Fragment, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { outwardSide, type Side, type Space, type UnitLayout } from '@/lib/apartments';
import {
  ceilingMaterial,
  doorMaterial,
  fabricMaterial,
  floorLabelTexture,
  floorMaterial,
  frameMaterial,
  glassMaterial,
  graniteMaterial,
  laminateMaterial,
  linenMaterial,
  metalMaterial,
  plantMaterial,
  porcelainMaterial,
  potMaterial,
  railMaterial,
  rugMaterial,
  screenMaterial,
  shutterMaterial,
  skirtingMaterial,
  wallMaterial,
  woodMaterial,
} from '@/lib/interiorMaterials';

export type ViewMode = 'doll' | 'walk';

const T = 0.11; // partition half-thickness drawn inside each room
const DOOR_W = 0.95;
const DOOR_H = 2.1;
const SILL = 0.9;
const HEAD = 2.25;
const SLIDER_H = 2.4;
const GLOW = new THREE.Color('#f5c045');

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ walls -- */

interface SlabProps {
  axis: 'x' | 'z';
  from: number;
  to: number;
  at: number;
  y0: number;
  y1: number;
  material: THREE.Material;
  thickness?: number;
}
function Slab({ axis, from, to, at, y0, y1, material, thickness = T }: SlabProps) {
  const len = to - from;
  if (len <= 0.02 || y1 - y0 <= 0.02) return null;
  const mid = from + len / 2;
  return (
    <mesh
      position={axis === 'x' ? [mid, (y0 + y1) / 2, at] : [at, (y0 + y1) / 2, mid]}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={axis === 'x' ? [len, y1 - y0, thickness] : [thickness, y1 - y0, len]} />
    </mesh>
  );
}

function Glazing({ axis, from, to, at, y0, y1, mullions }: Omit<SlabProps, 'material' | 'thickness'> & { mullions: number }) {
  const glass = glassMaterial();
  const frame = frameMaterial();
  const len = to - from;
  if (len <= 0.05) return null;
  const mid = from + len / 2;
  const pos: [number, number, number] = axis === 'x' ? [mid, (y0 + y1) / 2, at] : [at, (y0 + y1) / 2, mid];
  return (
    <group>
      <mesh position={pos} material={glass}>
        <boxGeometry args={axis === 'x' ? [len, y1 - y0, 0.02] : [0.02, y1 - y0, len]} />
      </mesh>
      {/* outer frame */}
      {[y0, y1].map((y) => (
        <mesh key={y} position={axis === 'x' ? [mid, y, at] : [at, y, mid]} material={frame}>
          <boxGeometry args={axis === 'x' ? [len, 0.06, 0.09] : [0.09, 0.06, len]} />
        </mesh>
      ))}
      {Array.from({ length: mullions + 1 }, (_, i) => {
        const t = from + (i * len) / mullions;
        return (
          <mesh key={i} position={axis === 'x' ? [t, (y0 + y1) / 2, at] : [at, (y0 + y1) / 2, t]} material={frame}>
            <boxGeometry args={axis === 'x' ? [0.05, y1 - y0, 0.09] : [0.09, y1 - y0, 0.05]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Door shown open and folded flat against its own wall, so it never blocks a view. */
function DoorLeaf({
  axis,
  at,
  from,
  to,
  gapStart,
  gapEnd,
  height,
}: {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  gapStart: number;
  gapEnd: number;
  height: number;
}) {
  const wood = doorMaterial();
  const metal = metalMaterial();
  // park the leaf on whichever side of the opening has more wall
  const parkLeft = gapStart - from > to - gapEnd;
  const centre = parkLeft ? gapStart - DOOR_W / 2 : gapEnd + DOOR_W / 2;
  const handle = parkLeft ? centre - DOOR_W / 2 + 0.12 : centre + DOOR_W / 2 - 0.12;
  const off = 0.09;
  const h = Math.max(0.2, height - 0.05);
  return (
    <group>
      <mesh position={axis === 'x' ? [centre, h / 2, at + off] : [at + off, h / 2, centre]} material={wood} castShadow>
        <boxGeometry args={axis === 'x' ? [DOOR_W, h, 0.045] : [0.045, h, DOOR_W]} />
      </mesh>
      {h > 1.1 && (
        <mesh position={axis === 'x' ? [handle, 1.02, at + off + 0.04] : [at + off + 0.04, 1.02, handle]} material={metal}>
          <boxGeometry args={axis === 'x' ? [0.13, 0.028, 0.028] : [0.028, 0.028, 0.13]} />
        </mesh>
      )}
    </group>
  );
}

/** Doll mode is a sectional cut: everything above this height is omitted. */
export const CUT = 1.55;

function SideWall({ space, side, mode }: { space: Space; side: Side; mode: ViewMode }) {
  const wall = wallMaterial();
  const skirt = skirtingMaterial();
  const H = mode === 'doll' ? CUT : space.height;
  const axis: 'x' | 'z' = side === 'n' || side === 's' ? 'x' : 'z';
  const from = axis === 'x' ? space.x : space.z;
  const to = axis === 'x' ? space.x + space.w : space.z + space.d;
  const at =
    side === 'n' ? space.z + T / 2 : side === 's' ? space.z + space.d - T / 2 : side === 'w' ? space.x + T / 2 : space.x + space.w - T / 2;
  const L = to - from;
  if (L <= 0.05) return null;

  const door = space.doors.find((d) => d.side === side);
  const slider = space.sliders.includes(side);
  const win = space.windows.includes(side) && !door && !slider;
  const skirting = (
    <Slab axis={axis} from={from} to={to} at={at} y0={0} y1={0.1} material={skirt} thickness={T + 0.02} />
  );

  // A balcony's outer edge is a parapet with a glass rail, never a wall: this is
  // the one opening the buyer actually wants to look through.
  if (space.room === 'balcony' && side === outwardSide(space)) {
    return (
      <group>
        <Slab axis={axis} from={from} to={to} at={at} y0={0} y1={0.5} material={wall} thickness={T + 0.06} />
        <Slab axis={axis} from={from} to={to} at={at} y0={0.5} y1={0.54} material={graniteMaterial()} thickness={T + 0.14} />
        <Glazing axis={axis} from={from + 0.04} to={to - 0.04} at={at} y0={0.54} y1={1.12} mullions={Math.max(2, Math.round(L / 1.2))} />
        <Slab axis={axis} from={from} to={to} at={at} y0={1.12} y1={1.18} material={railMaterial()} thickness={T + 0.1} />
      </group>
    );
  }

  // full-height sliding glazing (balcony / sit-out fronts)
  if (slider) {
    const pier = 0.22;
    const glassTop = Math.min(SLIDER_H, H);
    return (
      <group>
        <Slab axis={axis} from={from} to={from + pier} at={at} y0={0} y1={H} material={wall} />
        <Slab axis={axis} from={to - pier} to={to} at={at} y0={0} y1={H} material={wall} />
        <Slab axis={axis} from={from + pier} to={to - pier} at={at} y0={SLIDER_H} y1={H} material={wall} />
        <Glazing axis={axis} from={from + pier} to={to - pier} at={at} y0={0.02} y1={glassTop} mullions={Math.max(2, Math.round(L / 1.1))} />
      </group>
    );
  }

  // window opening
  if (win) {
    const openW = clamp(L * 0.62, 0.9, 2.6);
    const s0 = from + (L - openW) / 2;
    const s1 = s0 + openW;
    const glassTop = Math.min(HEAD, H);
    return (
      <group>
        {skirting}
        <Slab axis={axis} from={from} to={s0} at={at} y0={0} y1={H} material={wall} />
        <Slab axis={axis} from={s1} to={to} at={at} y0={0} y1={H} material={wall} />
        <Slab axis={axis} from={s0} to={s1} at={at} y0={0} y1={Math.min(SILL, H)} material={wall} />
        <Slab axis={axis} from={s0} to={s1} at={at} y0={HEAD} y1={H} material={wall} />
        <Slab axis={axis} from={s0 - 0.05} to={s1 + 0.05} at={at} y0={SILL} y1={SILL + 0.05} material={graniteMaterial()} thickness={T + 0.12} />
        {glassTop > SILL + 0.06 && <Glazing axis={axis} from={s0} to={s1} at={at} y0={SILL + 0.05} y1={glassTop} mullions={2} />}
      </group>
    );
  }

  // doorway
  if (door) {
    const gap = Math.min(DOOR_W, L - 0.3);
    const c = from + clamp(door.at, 0.1, 0.9) * L;
    const g0 = clamp(c - gap / 2, from, to - gap);
    const g1 = g0 + gap;
    const jamb = Math.min(DOOR_H, H);
    return (
      <group>
        {skirting}
        <Slab axis={axis} from={from} to={g0} at={at} y0={0} y1={H} material={wall} />
        <Slab axis={axis} from={g1} to={to} at={at} y0={0} y1={H} material={wall} />
        <Slab axis={axis} from={g0} to={g1} at={at} y0={DOOR_H} y1={H} material={wall} />
        <Slab axis={axis} from={g0 - 0.05} to={g0} at={at} y0={0} y1={jamb} material={woodMaterial('#8f6b4a')} thickness={T + 0.05} />
        <Slab axis={axis} from={g1} to={g1 + 0.05} at={at} y0={0} y1={jamb} material={woodMaterial('#8f6b4a')} thickness={T + 0.05} />
        {space.key !== 'passage' && <DoorLeaf axis={axis} at={at} from={from} to={to} gapStart={g0} gapEnd={g1} height={jamb} />}
      </group>
    );
  }

  return (
    <group>
      {skirting}
      <Slab axis={axis} from={from} to={to} at={at} y0={0} y1={H} material={wall} />
    </group>
  );
}

/* -------------------------------------------------------------- furniture -- */

function Bed({ lw, size }: { lw: number; size: 'king' | 'queen' }) {
  const bw = size === 'king' ? 1.83 : 1.52;
  const width = Math.min(bw, lw - 1.2);
  const len = 2.03;
  const linen = linenMaterial();
  const wood = woodMaterial('#7d5a3d');
  const back = -len / 2;
  return (
    <group>
      <RoundedBox args={[width + 0.18, 1.08, 0.12]} radius={0.04} smoothness={3} position={[0, 0.54, back - 0.07]} material={fabricMaterial('#6d6255')} castShadow />
      <RoundedBox args={[width, 0.3, len]} radius={0.03} smoothness={3} position={[0, 0.17, 0]} material={wood} castShadow />
      <RoundedBox args={[width + 0.05, 0.24, len - 0.02]} radius={0.05} smoothness={4} position={[0, 0.45, 0]} material={linen} castShadow />
      <RoundedBox args={[width + 0.08, 0.07, len * 0.62]} radius={0.03} smoothness={3} position={[0, 0.59, 0.28]} material={fabricMaterial('#e8e2d4')} castShadow />
      <RoundedBox args={[width + 0.09, 0.055, 0.48]} radius={0.025} smoothness={3} position={[0, 0.63, 0.62]} material={fabricMaterial('#c4a057')} castShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[width * 0.44, 0.14, 0.38]} radius={0.06} smoothness={4} position={[s * width * 0.24, 0.64, back + 0.34]} rotation={[-0.28, 0, 0]} material={linen} castShadow />
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (width / 2 + 0.3), 0, back + 0.26]}>
          <RoundedBox args={[0.42, 0.46, 0.38]} radius={0.02} smoothness={3} position={[0, 0.23, 0]} material={wood} castShadow />
          <mesh position={[0, 0.55, 0]} material={metalMaterial()}>
            <cylinderGeometry args={[0.014, 0.045, 0.16, 12]} />
          </mesh>
          <mesh position={[0, 0.7, 0]} material={porcelainMaterial()} castShadow>
            <sphereGeometry args={[0.09, 14, 10]} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.09, 14, 10]} />
            <meshStandardMaterial color="#fff6e0" emissive="#ffe7b8" emissiveIntensity={0.85} transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Wardrobe({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  const width = Math.min(ld - 0.6, 2.6);
  const h = Math.min(2.38, cap - 0.06);
  const lam = laminateMaterial();
  const metal = metalMaterial();
  const shutters = Math.max(2, Math.round(width / 0.6));
  return (
    <group position={[-lw / 2 + 0.31, 0, 0.1]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, h / 2, 0]} material={lam} castShadow receiveShadow>
        <boxGeometry args={[width, h, 0.6]} />
      </mesh>
      {/* shutter reveals so it reads as joinery, not a slab */}
      {Array.from({ length: shutters - 1 }, (_, i) => (
        <mesh key={i} position={[-width / 2 + ((i + 1) * width) / shutters, h / 2, 0.301]} material={metal}>
          <boxGeometry args={[0.01, h - 0.06, 0.012]} />
        </mesh>
      ))}
      {Array.from({ length: shutters }, (_, i) => (
        <mesh key={`h${i}`} position={[-width / 2 + (i + 0.5) * (width / shutters), Math.min(1.05, h - 0.3), 0.315]} material={metal}>
          <boxGeometry args={[0.025, 0.32, 0.025]} />
        </mesh>
      ))}
      {h > 2.3 && (
        <mesh position={[0, h + 0.03, 0]} material={woodMaterial('#a07c58')}>
          <boxGeometry args={[width + 0.04, 0.05, 0.64]} />
        </mesh>
      )}
    </group>
  );
}

function Sofa({ lw }: { lw: number }) {
  const width = Math.min(lw - 1.0, 2.4);
  const body = fabricMaterial('#8a8174');
  const seat = fabricMaterial('#cfc6b4');
  const cushion = fabricMaterial('#d8c4a0');
  const leg = woodMaterial('#4f3b28');
  const seats = width > 2.0 ? 3 : 2;
  const sw = (width - 0.34) / seats;
  return (
    <group>
      <RoundedBox args={[width, 0.22, 0.92]} radius={0.04} smoothness={3} position={[0, 0.2, -0.02]} material={body} castShadow />
      {Array.from({ length: seats }, (_, i) => (
        <RoundedBox key={i} args={[sw - 0.04, 0.16, 0.76]} radius={0.05} smoothness={4} position={[-width / 2 + 0.17 + (i + 0.5) * sw, 0.4, 0.02]} material={seat} castShadow />
      ))}
      {Array.from({ length: seats }, (_, i) => (
        <RoundedBox key={`b${i}`} args={[sw - 0.04, 0.4, 0.18]} radius={0.05} smoothness={4} position={[-width / 2 + 0.17 + (i + 0.5) * sw, 0.62, -0.34]} rotation={[-0.14, 0, 0]} material={seat} castShadow />
      ))}
      <RoundedBox args={[width, 0.68, 0.14]} radius={0.04} smoothness={3} position={[0, 0.56, -0.46]} material={body} castShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.16, 0.42, 0.9]} radius={0.05} smoothness={3} position={[s * (width / 2 - 0.08), 0.44, -0.02]} material={body} castShadow />
      ))}
      {[-1, 1].map((s) => (
        <RoundedBox key={`s${s}`} args={[0.34, 0.32, 0.1]} radius={0.04} smoothness={3} position={[s * (width / 2 - 0.36), 0.64, -0.2]} rotation={[-0.35, s * 0.18, 0]} material={cushion} castShadow />
      ))}
      {[-1, 1].map((s) =>
        [-1, 1].map((k) => (
          <mesh key={`l${s}${k}`} position={[s * (width / 2 - 0.12), 0.045, k * 0.34]} material={leg}>
            <cylinderGeometry args={[0.028, 0.028, 0.09, 10]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Framed art, the cheapest way to stop a render looking like an empty shell. */
function WallArt({ width, y, z }: { width: number; y: number; z: number }) {
  const frame = woodMaterial('#3f3327');
  const tones = ['#c8b79c', '#8d9a92', '#b0876a'];
  const panels = width > 1.4 ? 3 : 2;
  const pw = Math.min(0.46, (width * 0.8) / panels);
  return (
    <group position={[0, y, z]}>
      {Array.from({ length: panels }, (_, i) => (
        <group key={i} position={[(i - (panels - 1) / 2) * (pw + 0.12), 0, 0]}>
          <mesh material={frame} castShadow>
            <boxGeometry args={[pw, 0.6, 0.03]} />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <planeGeometry args={[pw - 0.06, 0.54]} />
            <meshStandardMaterial color={tones[i % 3]} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Full-height sheers beside the glazing. */
function Curtains({ span, height, z }: { span: number; height: number; z: number }) {
  const sheer = fabricMaterial('#eae4d8');
  const rail = metalMaterial();
  const folds = 7;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, height - 0.06, 0]} material={rail}>
        <boxGeometry args={[span, 0.04, 0.04]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (span / 2 - 0.24), 0, 0]}>
          {Array.from({ length: folds }, (_, i) => (
            <mesh
              key={i}
              position={[side * (i - folds / 2) * 0.055, (height - 0.12) / 2, (i % 2 === 0 ? 0.035 : -0.02)]}
              material={sheer}
              castShadow
            >
              <boxGeometry args={[0.06, height - 0.14, 0.09]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function LivingSet({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  return (
    <group>
      <mesh position={[0, 0.016, 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={rugMaterial()} receiveShadow>
        <planeGeometry args={[Math.min(lw - 0.8, 3.2), Math.min(ld - 1.4, 2.4)]} />
      </mesh>
      <group position={[0, 0, -ld / 2 + 0.62]}>
        <Sofa lw={lw} />
      </group>
      {cap > 1.9 && <WallArt width={Math.min(lw - 1.0, 2.4)} y={1.62} z={-ld / 2 + 0.11} />}
      <RoundedBox args={[Math.min(lw - 1.8, 1.2), 0.07, 0.62]} radius={0.03} smoothness={3} position={[0, 0.2, 0.1]} material={woodMaterial('#6f4f34')} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * Math.min(lw - 2.0, 1.1) * 0.42, 0.09, 0.1]} material={metalMaterial()}>
          <boxGeometry args={[0.06, 0.18, 0.5]} />
        </mesh>
      ))}
      <group position={[-lw / 2 + 0.4, 0, ld / 2 - 0.5]}>
        <mesh position={[0, 0.18, 0]} material={potMaterial()} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 14]} />
        </mesh>
        <mesh position={[0, 0.82, 0]} material={plantMaterial()} castShadow>
          <sphereGeometry args={[0.42, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}

function TvWall({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  const panelW = Math.min(lw - 1.0, 2.6);
  const panelH = Math.min(2.0, cap - 0.1);
  return (
    <group position={[0, 0, ld / 2 - 0.16]}>
      <mesh position={[0, panelH / 2 + 0.3, 0]} material={woodMaterial('#5d4632')} castShadow>
        <boxGeometry args={[panelW, panelH, 0.06]} />
      </mesh>
      {cap > 1.9 && (
        <mesh position={[0, 1.42, 0.06]} material={screenMaterial()}>
          <boxGeometry args={[panelW * 0.72, 0.72, 0.05]} />
        </mesh>
      )}
      <mesh position={[0, 0.24, 0.16]} material={laminateMaterial()} castShadow receiveShadow>
        <boxGeometry args={[panelW, 0.44, 0.42]} />
      </mesh>
    </group>
  );
}

function DiningSet({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  const long = Math.min(Math.max(lw, ld) - 1.6, 2.0);
  const wood = woodMaterial('#6b4b30');
  const seat = fabricMaterial('#8d7f6d');
  const seats = long > 1.7 ? 3 : 2;
  return (
    <group>
      <RoundedBox args={[long, 0.055, 0.92]} radius={0.03} smoothness={4} position={[0, 0.74, 0]} material={wood} castShadow />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (long / 2 - 0.12), 0.37, sz * 0.36]} material={wood}>
            <boxGeometry args={[0.07, 0.74, 0.07]} />
          </mesh>
        )),
      )}
      {Array.from({ length: seats }, (_, i) =>
        [-1, 1].map((sz) => {
          const x = (i - (seats - 1) / 2) * (long / seats);
          return (
            <group key={`${i}${sz}`} position={[x, 0, sz * 0.78]} rotation={[0, sz > 0 ? Math.PI : 0, 0]}>
              <RoundedBox args={[0.44, 0.06, 0.44]} radius={0.03} smoothness={3} position={[0, 0.44, 0]} material={seat} castShadow />
              <mesh position={[0, 0.72, -0.2]} material={wood} castShadow>
                <boxGeometry args={[0.44, 0.56, 0.05]} />
              </mesh>
              {[-1, 1].map((k) =>
                [-1, 1].map((m) => (
                  <mesh key={`${k}${m}`} position={[k * 0.18, 0.21, m * 0.18]} material={wood}>
                    <boxGeometry args={[0.045, 0.42, 0.045]} />
                  </mesh>
                )),
              )}
            </group>
          );
        }),
      )}
      {cap > 2.5 && (
        <group position={[0, 2.2, 0]}>
          <mesh material={metalMaterial()}>
            <cylinderGeometry args={[0.02, 0.02, 0.7, 8]} />
          </mesh>
          <mesh position={[0, -0.42, 0]} material={porcelainMaterial()}>
            <coneGeometry args={[0.26, 0.24, 16, 1, true]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function KitchenSet({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  const lam = laminateMaterial();
  const shutter = shutterMaterial();
  const stone = graniteMaterial();
  const metal = metalMaterial();
  const runX = lw - 0.24;
  const runZ = ld - 0.9;
  const uppers = Math.max(2, Math.round((runX * 0.82) / 0.5));
  const baseDoors = Math.max(2, Math.round(runX / 0.55));
  return (
    <group>
      {/* L-shaped base run: back wall + right return */}
      <group position={[0, 0, -ld / 2 + 0.31]}>
        <mesh position={[0, 0.44, 0]} material={lam} castShadow receiveShadow>
          <boxGeometry args={[runX, 0.88, 0.6]} />
        </mesh>
        {/* shutter joints on the base run */}
        {Array.from({ length: baseDoors - 1 }, (_, i) => (
          <mesh key={i} position={[-runX / 2 + ((i + 1) * runX) / baseDoors, 0.44, 0.305]} material={metal}>
            <boxGeometry args={[0.008, 0.84, 0.008]} />
          </mesh>
        ))}
        <RoundedBox args={[runX + 0.04, 0.05, 0.64]} radius={0.015} smoothness={3} position={[0, 0.9, 0.01]} material={stone} castShadow />
        {/* fridge at the open end */}
        <RoundedBox args={[0.62, 1.82, 0.64]} radius={0.03} smoothness={3} position={[runX / 2 - 0.34, 0.91, 0.62]} material={porcelainMaterial()} castShadow />
        <mesh position={[runX / 2 - 0.34, 1.05, 0.95]} material={metalMaterial()}>
          <boxGeometry args={[0.04, 0.7, 0.02]} />
        </mesh>
        {/* wall units in a light matte shutter, split into doors */}
        {cap > 2.1 &&
          Array.from({ length: uppers }, (_, i) => {
            const uw = (runX * 0.82) / uppers;
            return (
              <mesh key={i} position={[-runX * 0.41 + (i + 0.5) * uw, 1.66, -0.14]} material={shutter} castShadow>
                <boxGeometry args={[uw - 0.012, 0.7, 0.34]} />
              </mesh>
            );
          })}
        {/* dado tiling between counter and wall units */}
        <mesh position={[0, 1.16, -0.29]} material={porcelainMaterial()}>
          <boxGeometry args={[runX, Math.min(0.48, Math.max(0.1, cap - 0.94)), 0.02]} />
        </mesh>
        {/* hob + chimney */}
        <mesh position={[-runX * 0.22, 0.94, 0.02]} material={screenMaterial()}>
          <boxGeometry args={[0.58, 0.03, 0.42]} />
        </mesh>
        {cap > 2.1 && (
          <mesh position={[-runX * 0.22, 1.62, -0.06]} material={metal} castShadow>
            <boxGeometry args={[0.62, 0.16, 0.46]} />
          </mesh>
        )}
      </group>
      <group position={[lw / 2 - 0.31, 0, 0.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.44, 0]} material={lam} castShadow receiveShadow>
          <boxGeometry args={[runZ, 0.88, 0.6]} />
        </mesh>
        <mesh position={[0, 0.9, 0.01]} material={stone} castShadow>
          <boxGeometry args={[runZ + 0.04, 0.05, 0.64]} />
        </mesh>
        {/* sink + tap */}
        <mesh position={[0, 0.9, 0.02]} material={metal}>
          <boxGeometry args={[0.62, 0.1, 0.42]} />
        </mesh>
        <mesh position={[0, 1.06, -0.2]} material={metal}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function Bath({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  const porcelain = porcelainMaterial();
  const metal = metalMaterial();
  const tileH = Math.min(2.1, cap - 0.05);
  return (
    <group>
      {/* wall tiling up to lintel */}
      <mesh position={[0, tileH / 2, -ld / 2 + 0.06]} material={porcelain}>
        <boxGeometry args={[lw - 0.2, tileH, 0.02]} />
      </mesh>
      {/* vanity */}
      <group position={[-lw / 2 + 0.34, 0, -ld / 2 + 0.55]}>
        <mesh position={[0, 0.4, 0]} material={laminateMaterial()} castShadow>
          <boxGeometry args={[0.56, 0.8, 0.46]} />
        </mesh>
        <mesh position={[0, 0.84, 0]} material={porcelain} castShadow>
          <boxGeometry args={[0.6, 0.12, 0.48]} />
        </mesh>
        <mesh position={[0, 1.5, -0.2]} material={metal}>
          <boxGeometry args={[0.5, 0.7, 0.02]} />
        </mesh>
      </group>
      {/* wc */}
      <group position={[lw / 2 - 0.36, 0, -ld / 2 + 0.5]}>
        <mesh position={[0, 0.2, 0]} material={porcelain} castShadow>
          <boxGeometry args={[0.38, 0.4, 0.62]} />
        </mesh>
        <mesh position={[0, 0.52, -0.18]} material={porcelain} castShadow>
          <boxGeometry args={[0.36, 0.28, 0.16]} />
        </mesh>
      </group>
      {/* shower zone with glass partition */}
      <group position={[0, 0, ld / 2 - 0.6]}>
        <mesh position={[0, tileH / 2, 0.5]} material={glassMaterial()}>
          <boxGeometry args={[lw - 0.3, tileH, 0.015]} />
        </mesh>
        {cap > 2.3 && (
          <mesh position={[0, 2.2, 0]} material={metal}>
            <cylinderGeometry args={[0.09, 0.09, 0.04, 14]} />
          </mesh>
        )}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={metal}>
          <circleGeometry args={[0.06, 12]} />
        </mesh>
      </group>
    </group>
  );
}

function SitOut({ lw, ld }: { lw: number; ld: number }) {
  const rail = railMaterial();
  const glass = glassMaterial();
  const posts = Math.max(2, Math.round(lw / 1.2));
  return (
    <group>
      {/* balcony railing on the outer edge */}
      <mesh position={[0, 0.58, -ld / 2 + 0.06]} material={glass}>
        <boxGeometry args={[lw - 0.1, 1.1, 0.02]} />
      </mesh>
      <mesh position={[0, 1.14, -ld / 2 + 0.06]} material={rail}>
        <boxGeometry args={[lw, 0.06, 0.06]} />
      </mesh>
      <mesh position={[0, 0.03, -ld / 2 + 0.06]} material={rail}>
        <boxGeometry args={[lw, 0.06, 0.09]} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => (
        <mesh key={i} position={[-lw / 2 + ((i + 0.5) * lw) / posts, 0.58, -ld / 2 + 0.06]} material={rail}>
          <boxGeometry args={[0.04, 1.14, 0.09]} />
        </mesh>
      ))}
      {/* two chairs and a side table */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.66, 0, 0.1]}>
          <mesh position={[0, 0.36, 0]} material={fabricMaterial('#5f6b62')} castShadow>
            <boxGeometry args={[0.5, 0.08, 0.5]} />
          </mesh>
          <mesh position={[0, 0.62, -0.22]} material={woodMaterial('#7b5c3f')} castShadow>
            <boxGeometry args={[0.5, 0.5, 0.06]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.22, 0.1]} material={woodMaterial('#7b5c3f')} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.44, 14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (lw / 2 - 0.4), 0, 0.2]}>
          <mesh position={[0, 0.2, 0]} material={potMaterial()} castShadow>
            <cylinderGeometry args={[0.19, 0.15, 0.4, 12]} />
          </mesh>
          <mesh position={[0, 0.66, 0]} material={plantMaterial()} castShadow>
            <sphereGeometry args={[0.32, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FoyerSet({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  return (
    <group position={[0, 0, -ld / 2 + 0.3]}>
      <mesh position={[0, 0.42, 0]} material={woodMaterial('#6d4e35')} castShadow>
        <boxGeometry args={[Math.min(lw - 0.6, 1.1), 0.84, 0.36]} />
      </mesh>
      {cap > 1.9 && (
        <mesh position={[0, 1.5, -0.14]} material={metalMaterial()}>
          <boxGeometry args={[Math.min(lw - 0.9, 0.7), 0.9, 0.03]} />
        </mesh>
      )}
      <mesh position={[0, 0.9, 0]} material={potMaterial()} castShadow>
        <cylinderGeometry args={[0.11, 0.09, 0.2, 12]} />
      </mesh>
    </group>
  );
}

function StudySet({ lw, ld, cap }: { lw: number; ld: number; cap: number }) {
  return (
    <group position={[0, 0, -ld / 2 + 0.42]}>
      <mesh position={[0, 0.72, 0]} material={woodMaterial('#6b4b30')} castShadow receiveShadow>
        <boxGeometry args={[Math.min(lw - 0.8, 1.5), 0.05, 0.62]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (Math.min(lw - 0.8, 1.5) / 2 - 0.06), 0.36, 0]} material={laminateMaterial()}>
          <boxGeometry args={[0.06, 0.72, 0.6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.98, -0.24]} material={screenMaterial()}>
        <boxGeometry args={[0.56, 0.34, 0.03]} />
      </mesh>
      <group position={[0, 0, 0.62]}>
        <mesh position={[0, 0.44, 0]} material={fabricMaterial('#4d5a63')} castShadow>
          <boxGeometry args={[0.44, 0.07, 0.44]} />
        </mesh>
        <mesh position={[0, 0.72, 0.2]} material={fabricMaterial('#4d5a63')} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.06]} />
        </mesh>
      </group>
      {cap > 1.9 && (
        <mesh position={[0, 1.72, -0.28]} material={woodMaterial('#8a6644')} castShadow>
          <boxGeometry args={[Math.min(lw - 0.9, 1.3), 0.05, 0.28]} />
        </mesh>
      )}
    </group>
  );
}

function Washer({ ld }: { lw: number; ld: number }) {
  return (
    <group position={[0, 0, -ld / 2 + 0.4]}>
      <mesh position={[0, 0.42, 0]} material={porcelainMaterial()} castShadow>
        <boxGeometry args={[0.6, 0.84, 0.6]} />
      </mesh>
      <mesh position={[0, 0.52, 0.31]} material={frameMaterial()}>
        <cylinderGeometry args={[0.19, 0.19, 0.03, 18]} />
      </mesh>
    </group>
  );
}

function Fittings({ space, cap }: { space: Space; cap: number }) {
  const swap = space.anchor === 'e' || space.anchor === 'w';
  const lw = swap ? space.d : space.w;
  const ld = swap ? space.w : space.d;
  const yaw: Record<Side, number> = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };
  return (
    <group position={[space.x + space.w / 2, 0, space.z + space.d / 2]} rotation={[0, yaw[space.anchor], 0]}>
      {space.fittings.map((f) => (
        <Fragment key={f}>
          {f === 'bed-king' && <Bed lw={lw} size="king" />}
          {f === 'bed-queen' && <Bed lw={lw} size="queen" />}
          {f === 'wardrobe' && <Wardrobe lw={lw} ld={ld} cap={cap} />}
          {f === 'sofa' && <LivingSet lw={lw} ld={ld} cap={cap} />}
          {f === 'tv' && <TvWall lw={lw} ld={ld} cap={cap} />}
          {f === 'dining' && <DiningSet lw={lw} ld={ld} cap={cap} />}
          {f === 'kitchen' && <KitchenSet lw={lw} ld={ld} cap={cap} />}
          {f === 'bath' && <Bath lw={lw} ld={ld} cap={cap} />}
          {f === 'sit-out' && <SitOut lw={lw} ld={ld} />}
          {f === 'foyer' && <FoyerSet lw={lw} ld={ld} cap={cap} />}
          {f === 'study' && <StudySet lw={lw} ld={ld} cap={cap} />}
          {f === 'washer' && <Washer lw={lw} ld={ld} />}
        </Fragment>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ rooms -- */

function SpaceBlock({
  space,
  mode,
  active,
  onPick,
  showLabel,
}: {
  space: Space;
  mode: ViewMode;
  active: boolean;
  onPick?: (space: Space) => void;
  showLabel: boolean;
}) {
  const floor = floorMaterial(space.finish, space.w, space.d);
  const sides: Side[] = ['n', 'e', 's', 'w'];
  const isBalcony = space.finish === 'deck';
  const pick = onPick && space.tourable ? onPick : undefined;

  return (
    <group>
      <mesh
        position={[space.x + space.w / 2, 0.005, space.z + space.d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={floor}
        receiveShadow
        onClick={pick ? (e) => { e.stopPropagation(); pick(space); } : undefined}
        onPointerOver={pick ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
        onPointerOut={pick ? () => { document.body.style.cursor = 'auto'; } : undefined}
      >
        <planeGeometry args={[space.w, space.d]} />
      </mesh>

      {/* selection glow, like the reel's yellow room highlight */}
      {active && (
        <mesh position={[space.x + space.w / 2, 0.02, space.z + space.d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[space.w - 0.12, space.d - 0.12]} />
          <meshBasicMaterial color={GLOW} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {sides.map((side) => (
        <SideWall key={side} space={space} side={side} mode={mode} />
      ))}

      {mode === 'walk' &&
        space.sliders.map((side) => {
          const axis = side === 'n' || side === 's' ? 'x' : 'z';
          const span = axis === 'x' ? space.w : space.d;
          const inset = 0.2;
          const at = side === 'n' ? space.z + inset : side === 's' ? space.z + space.d - inset : side === 'w' ? space.x + inset : space.x + space.w - inset;
          return (
            <group
              key={`curtain-${side}`}
              position={axis === 'x' ? [space.x + space.w / 2, 0, at] : [at, 0, space.z + space.d / 2]}
              rotation={[0, axis === 'x' ? 0 : Math.PI / 2, 0]}
            >
              <Curtains span={span - 0.3} height={space.height - 0.12} z={0} />
            </group>
          );
        })}

      {/* room name and printed dimension read off the floor, like a printed 3D plan */}
      {showLabel && (
        <mesh position={[space.x + space.w / 2, 0.012, space.z + space.d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[space.w, space.d]} />
          <meshBasicMaterial map={floorLabelTexture(space.short, space.dim, space.w, space.d)} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {!isBalcony && mode === 'walk' && (
        <mesh position={[space.x + space.w / 2, space.height - 0.01, space.z + space.d / 2]} rotation={[Math.PI / 2, 0, 0]} material={ceilingMaterial()}>
          <planeGeometry args={[space.w, space.d]} />
        </mesh>
      )}

      {/* recessed ceiling light */}
      {!isBalcony && mode === 'walk' && (
        <mesh position={[space.x + space.w / 2, space.height - 0.04, space.z + space.d / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.14, 16]} />
          <meshStandardMaterial color="#fff6e6" emissive="#ffe6bd" emissiveIntensity={1.6} />
        </mesh>
      )}

      <Fittings space={space} cap={space.height} />
    </group>
  );
}

/* ------------------------------------------------------------------- shell -- */

export default function ApartmentModel({
  layout,
  mode,
  activeKey,
  onPick,
  labels = true,
}: {
  layout: UnitLayout;
  mode: ViewMode;
  activeKey?: string | null;
  onPick?: (space: Space) => void;
  labels?: boolean;
}) {
  const offset = useMemo<[number, number, number]>(() => [-layout.width / 2, 0, -layout.depth / 2], [layout.width, layout.depth]);
  return (
    <group position={offset}>
      {/* structural slab */}
      <mesh position={[layout.width / 2, -0.09, layout.depth / 2]} receiveShadow>
        <boxGeometry args={[layout.width + 0.5, 0.18, layout.depth + 0.5]} />
        <meshStandardMaterial color="#a9a49b" roughness={1} />
      </mesh>
      {layout.spaces.map((space) => (
        <SpaceBlock
          key={space.key}
          space={space}
          mode={mode}
          active={activeKey === space.key}
          onPick={onPick}
          showLabel={labels && mode === 'doll'}
        />
      ))}
    </group>
  );
}
