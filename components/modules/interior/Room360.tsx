'use client';
/**
 * True in-room 360. The buyer stands inside their own unit at eye height,
 * drags to look around, scrolls to zoom the lens, and walks between rooms
 * through floor hotspots. Everything is rendered from the same geometry as the
 * dollhouse, so the 360 always matches the plan they were just looking at.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Sky } from '@react-three/drei';
import { facadeTextures, grassTexture } from '@/lib/siteLook';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { station, tourSpaces, viewpoint, type Space, type UnitLayout } from '@/lib/apartments';
import ApartmentModel from './ApartmentModel';

const FLOOR_ABOVE_GROUND = 46; // ~floor 15, so the glazing looks over rooftops
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ------------------------------------------------------- look controls ---- */

interface LookProps {
  target: [number, number, number];
  initialYaw: number;
  onYaw?: (yaw: number) => void;
  onFov?: (fov: number) => void;
}
function LookControls({ target, initialYaw, onYaw, onFov }: LookProps) {
  const { camera, gl } = useThree();
  const PITCH0 = -0.14; // arrive looking slightly down, the way a person scans a room
  const yaw = useRef(initialYaw);
  const pitch = useRef(PITCH0);
  const goalYaw = useRef(initialYaw);
  const goalPitch = useRef(PITCH0);
  const fov = useRef(80);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const move = useRef<{ from: THREE.Vector3; to: THREE.Vector3; start: number } | null>(null);

  // travel to a new standing position
  useEffect(() => {
    const to = new THREE.Vector3(...target);
    if (camera.position.lengthSq() === 0) {
      camera.position.copy(to);
    } else {
      move.current = { from: camera.position.clone(), to, start: performance.now() };
    }
    goalYaw.current = initialYaw;
    yaw.current = initialYaw;
    goalPitch.current = PITCH0;
    pitch.current = PITCH0;
  }, [target, initialYaw, camera]);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      el.style.cursor = 'grabbing';
    };
    const up = () => {
      dragging.current = false;
      el.style.cursor = 'grab';
    };
    const pointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      const speed = (fov.current / 72) * 0.0034;
      goalYaw.current -= dx * speed;
      goalPitch.current = THREE.MathUtils.clamp(goalPitch.current - dy * speed, -0.95, 0.85);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      fov.current = THREE.MathUtils.clamp(fov.current + e.deltaY * 0.045, 32, 88);
      onFov?.(fov.current);
    };
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointermove', pointerMove);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', pointerMove);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, onFov]);

  // device orientation on mobile
  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (dragging.current || e.alpha === null || e.beta === null) return;
      goalYaw.current = THREE.MathUtils.degToRad(e.alpha);
      goalPitch.current = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(e.beta - 90), -0.9, 0.8);
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, []);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (move.current) {
      const { from, to, start } = move.current;
      const t = Math.min(1, (performance.now() - start) / 950);
      cam.position.lerpVectors(from, to, easeInOut(t));
      if (t >= 1) move.current = null;
    }
    yaw.current += (goalYaw.current - yaw.current) * 0.16;
    pitch.current += (goalPitch.current - pitch.current) * 0.16;
    cam.rotation.set(0, 0, 0);
    cam.rotateY(yaw.current);
    cam.rotateX(pitch.current);
    if (Math.abs(cam.fov - fov.current) > 0.01) {
      cam.fov += (fov.current - cam.fov) * 0.2;
      cam.updateProjectionMatrix();
    }
    onYaw?.(yaw.current);
  });

  return null;
}

/* ------------------------------------------------------------- outside ---- */

function Outside({ layout }: { layout: UnitLayout }) {
  const blocks = useMemo(() => {
    let seed = 4711;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    return Array.from({ length: 48 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 80 + rnd() * 380;
      const h = 14 + rnd() * 48;
      return {
        p: [Math.cos(a) * r, h / 2 - FLOOR_ABOVE_GROUND, Math.sin(a) * r] as [number, number, number],
        s: [16 + rnd() * 18, h, 16 + rnd() * 18] as [number, number, number],
        c: ['#cfc9be', '#d8d2c6', '#c4beb3', '#ddd7cb'][Math.floor(rnd() * 4)],
      };
    });
  }, []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    blocks.forEach((b, i) => {
      dummy.position.set(b.p[0], b.p[1], b.p[2]);
      dummy.scale.set(b.s[0], b.s[1], b.s[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(b.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, dummy, color]);
  const span = Math.max(layout.width, layout.depth);
  const look = useMemo(() => facadeTextures(), []);
  const grass = useMemo(() => {
    const t = grassTexture().clone();
    t.repeat.set(40, 40);
    t.needsUpdate = true;
    return t;
  }, []);

  return (
    <group>
      <Sky distance={9000} sunPosition={[220, 70, 80]} turbidity={6.5} rayleigh={0.85} mieCoefficient={0.006} mieDirectionalG={0.84} />
      <mesh position={[0, -FLOOR_ABOVE_GROUND, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      <mesh position={[0, -FLOOR_ABOVE_GROUND + 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 210]} />
        <meshStandardMaterial color="#b7b1a6" roughness={0.95} />
      </mesh>
      <mesh position={[span * 1.6, -FLOOR_ABOVE_GROUND + 0.55, -span]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 30]} />
        <meshPhysicalMaterial color="#1a7aa8" roughness={0.08} metalness={0.12} transmission={0.25} transparent opacity={0.92} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={look.map} roughness={0.7} metalness={0.04} />
      </instancedMesh>
      <mesh position={[-span * 2.4, 4, span * 0.2]}>
        <boxGeometry args={[span * 0.9, 52, span * 1.15]} />
        <meshStandardMaterial map={look.map} color="#e7e1d6" roughness={0.62} metalness={0.04} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ hotspots ---- */

function Hotspot({ space, onEnter }: { space: Space; onEnter: (s: Space) => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const [pos] = useMemo(() => [station(space, 0.06)], [space]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.09;
    ring.current.scale.setScalar(k);
  });
  return (
    <group position={pos}>
      <mesh
        ref={ring}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onEnter(space); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'grab'; }}
      >
        <ringGeometry args={[0.24, 0.34, 32]} />
        <meshBasicMaterial color="#f5c045" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <Html position={[0, 1.1, 0]} center distanceFactor={9} zIndexRange={[30, 0]}>
        <button
          onClick={() => onEnter(space)}
          className="whitespace-nowrap rounded-full border border-white/25 bg-black/75 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur transition hover:bg-[#f5c045] hover:text-black"
        >
          {space.short}
        </button>
      </Html>
    </group>
  );
}

/* --------------------------------------------------------------- scene ---- */

function Scene({
  layout,
  active,
  onEnter,
  onYaw,
  onFov,
}: {
  layout: UnitLayout;
  active: Space;
  onEnter: (s: Space) => void;
  onYaw: (y: number) => void;
  onFov: (f: number) => void;
}) {
  const others = useMemo(() => tourSpaces(layout).filter((s) => s.key !== active.key), [layout, active.key]);
  const view = useMemo(() => viewpoint(active), [active]);
  const centre = useMemo<[number, number, number]>(
    () => [active.x + active.w / 2 - layout.width / 2, 1.6, active.z + active.d / 2 - layout.depth / 2],
    [active, layout.width, layout.depth],
  );
  const world = useMemo<[number, number, number]>(
    () => [view.position[0] - layout.width / 2, view.position[1], view.position[2] - layout.depth / 2],
    [view, layout.width, layout.depth],
  );

  return (
    <>
      <Outside layout={layout} />
      <Environment files="/hdri/interior.hdr" environmentIntensity={0.7} background={false} />
      <ambientLight intensity={0.58} color="#fff1e2" />
      <hemisphereLight args={['#ffe8cc', '#6b6053', 0.7]} />
      {/* low-angle daylight through the glazing */}
      <directionalLight
        position={[layout.width * 1.6, 9, -layout.depth * 1.7]}
        intensity={1.35}
        color="#fff4e4"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={0.4}
        shadow-camera-far={80}
        shadow-bias={-0.0006}
        shadow-radius={4}
      />
      {/* warm fill from the ceiling fitting of the room you are standing in */}
      <pointLight position={[centre[0], active.height - 0.35, centre[2]]} intensity={3.4} distance={8} decay={2} color="#ffe8c6" />

      <ApartmentModel layout={layout} mode="walk" activeKey={null} labels={false} />

      <group position={[-layout.width / 2, 0, -layout.depth / 2]}>
        {others.map((s) => (
          <Hotspot key={s.key} space={s} onEnter={onEnter} />
        ))}
      </group>

      <LookControls target={world} initialYaw={view.yaw} onYaw={onYaw} onFov={onFov} />

      {/* No SSAO here: at interior scale it fringes every edge with dark speckle,
          which reads as dirt. Soft shadow maps plus bounce fill do the job cleanly. */}
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.16} luminanceThreshold={0.88} luminanceSmoothing={0.3} mipmapBlur />
        <Vignette eskil={false} offset={0.26} darkness={0.42} />
      </EffectComposer>
    </>
  );
}

export default function Room360({
  layout,
  active,
  onEnter,
  onYaw,
}: {
  layout: UnitLayout;
  active: Space;
  onEnter: (s: Space) => void;
  onYaw?: (yaw: number) => void;
}) {
  const [fov, setFov] = useState(80);
  const start = useMemo(() => {
    const view = viewpoint(active);
    return [
      view.position[0] - layout.width / 2,
      view.position[1],
      view.position[2] - layout.depth / 2,
    ] as [number, number, number];
  }, [active, layout.width, layout.depth]);
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 80, near: 0.08, far: 2500, position: start, rotation: [0, viewpoint(active).yaw, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense
          fallback={
            <Html center>
              <div className="flex flex-col items-center gap-3">
                <div className="shimmer h-24 w-40 rounded-2xl" />
                <div className="text-[10px] font-bold tracking-[0.28em] text-white/70">ENTERING THE ROOM</div>
              </div>
            </Html>
          }
        >
          <Scene layout={layout} active={active} onEnter={onEnter} onYaw={onYaw ?? (() => {})} onFov={setFov} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute bottom-[86px] left-1/2 z-[900] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] text-white/70 backdrop-blur">
        {Math.round(fov)}° FOV · DRAG TO LOOK · SCROLL TO ZOOM
      </div>
    </div>
  );
}
