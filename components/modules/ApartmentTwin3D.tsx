'use client';
/**
 * Furnished digital twin of the buyer's own unit — the dollhouse view.
 * Geometry comes from the real SFT schedule in lib/apartments.ts, so a 1265
 * and an 1825 are genuinely different homes, and west units are mirrored.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from '@react-three/drei';
import { EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useAppStore } from '@/store/useAppStore';
import { project } from '@/lib/data';
import { buildUnitLayout, tourSpaces, type Space } from '@/lib/apartments';
import ApartmentModel from './interior/ApartmentModel';
import { lockCanvasScroll } from '@/lib/lockCanvasScroll';

type Preset = 'iso' | 'top' | 'front';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function CameraRig({ preset, radius }: { preset: Preset; radius: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; start: number } | null>(null);

  const goal = useMemo(() => {
    if (preset === 'top') return new THREE.Vector3(0.001, radius * 1.7, 0.001);
    if (preset === 'front') return new THREE.Vector3(0, radius * 0.55, radius * 1.45);
    // steep three-quarter view: high enough to read every room over the full-height walls
    return new THREE.Vector3(radius * 0.62, radius * 1.34, radius * 0.86);
  }, [preset, radius]);

  useEffect(() => {
    anim.current = { from: camera.position.clone(), to: goal, start: performance.now() };
  }, [goal, camera]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    if (anim.current) {
      const { from, to, start } = anim.current;
      const t = Math.min(1, (performance.now() - start) / 900);
      camera.position.lerpVectors(from, to, easeOutCubic(t));
      if (t >= 1) anim.current = null;
    }
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      target={[0, 1.1, 0]}
      minDistance={radius * 0.45}
      maxDistance={radius * 2.6}
      minPolarAngle={0.08}
      maxPolarAngle={1.42}
      onStart={() => { anim.current = null; }}
    />
  );
}

function Studio({ radius }: { radius: number }) {
  const s = Math.max(radius, 8);
  return (
    <>
      <ambientLight intensity={0.75} color="#fff6ec" />
      <hemisphereLight args={['#fff4e6', '#c8c3bb', 0.85]} />
      <Environment files="/hdri/interior.hdr" environmentIntensity={0.75} background={false} />
      <directionalLight
        position={[s * 0.7, s * 1.5, s * 0.55]}
        intensity={1.85}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-near={0.5}
        shadow-camera-far={s * 5}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-s, s * 0.8, -s * 0.6]} intensity={0.55} color="#e6eeff" />
      <Environment resolution={128} frames={1}>
        <color attach="background" args={['#e9ebee']} />
        <Lightformer intensity={3.2} rotation-x={Math.PI / 2} position={[0, 8, 0]} scale={[20, 20, 1]} color="#ffffff" />
        <Lightformer intensity={1.4} rotation-y={Math.PI / 2} position={[-9, 3, 0]} scale={[18, 6, 1]} color="#e8effb" />
        <Lightformer intensity={1.5} rotation-y={-Math.PI / 2} position={[9, 3, 0]} scale={[18, 6, 1]} color="#fff1e0" />
        <Lightformer intensity={1.1} rotation-x={-Math.PI / 2} position={[0, -6, 0]} scale={[20, 20, 1]} color="#d8d4cd" />
      </Environment>
    </>
  );
}

export default function ApartmentTwin3D() {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const spaceKey = useAppStore((s) => s.spaceKey);
  const setSpace = useAppStore((s) => s.setSpace);
  const setModule = useAppStore((s) => s.setModule);
  const [preset, setPreset] = useState<Preset>('iso');
  const [hover, setHover] = useState<Space | null>(null);

  const flat = project.flats.find((f) => f.id === flatId) ?? project.flats[0];
  const layout = useMemo(() => buildUnitLayout(flat.sqft, Number(flat.flatNo) > 5), [flat.sqft, flat.flatNo]);
  const rooms = useMemo(() => tourSpaces(layout), [layout]);
  const radius = Math.max(layout.width, layout.depth) * 0.95;

  const enter = (space: Space) => {
    setSpace(space.key, space.room);
    setModule('tour');
  };

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [radius, radius, radius * 1.2], fov: 34, near: 0.1, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ gl }) => lockCanvasScroll(gl.domElement)}
      >
        <color attach="background" args={['#eceef1']} />
        <Suspense fallback={<Html center><div className="shimmer h-20 w-40 rounded-2xl" /></Html>}>
          <Studio radius={radius} />
          <ApartmentModel layout={layout} mode="doll" activeKey={hover?.key ?? spaceKey} onPick={enter} />
          <ContactShadows position={[0, -0.19, 0]} opacity={0.48} scale={radius * 3} blur={2.2} far={14} resolution={1024} />
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <N8AO aoRadius={0.55} intensity={1.15} quality="medium" />
            <Vignette offset={0.28} darkness={0.32} />
          </EffectComposer>
        </Suspense>
        <CameraRig preset={preset} radius={radius} />
      </Canvas>

      {/* unit plate */}
      <div className="pointer-events-none absolute left-5 bottom-24 z-10 max-w-[280px]">
        <p className="text-[9px] uppercase tracking-[0.28em] text-neutral-500">{layout.typeName} · {layout.bhk} BHK + {layout.baths}T</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{flat.sqft} SFT</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
          {flat.facing} facing · {layout.mirrored ? 'mirrored (west) unit' : 'east unit'} · every room drawn to the printed plan dimension.
        </p>
      </div>

      {/* room rail */}
      <div className="absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-1.5 md:flex">
        {rooms.map((space) => (
          <button
            key={space.key}
            onClick={() => enter(space)}
            onMouseEnter={() => setHover(space)}
            onMouseLeave={() => setHover(null)}
            className={`group w-[172px] rounded-xl border px-3 py-2 text-left shadow-sm transition ${
              (hover?.key ?? spaceKey) === space.key
                ? 'border-[#e0a422] bg-[#f5c045] text-black'
                : 'border-black/10 bg-white/85 text-neutral-800 backdrop-blur hover:border-black/25'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em]">{space.label}</div>
            <div className="text-[10px] opacity-65">{space.dim} · {space.sqft} sft</div>
          </button>
        ))}
      </div>

      {/* view presets */}
      <div className="absolute bottom-24 right-5 z-10 flex gap-1 rounded-full border border-black/10 bg-white/85 p-1 shadow-sm backdrop-blur">
        {([['iso', 'ISO'], ['top', 'TOP'], ['front', 'FRONT']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPreset(id)}
            className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-[0.18em] transition ${
              preset === id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-11 left-1/2 z-10 -translate-x-1/2 rounded-full border border-black/10 bg-white/85 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 backdrop-blur">
        Drag to orbit · scroll to zoom · click a room to walk inside
      </div>
    </div>
  );
}
