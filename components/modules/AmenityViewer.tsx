'use client';
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { project, assetUrl } from '@/lib/data';
import { usePhotoSphere, type Hotspot } from './usePhotoSphere';

export default function AmenityViewer() {
  const active = useAppStore((s) => s.activeAmenity);
  const setActive = useAppStore((s) => s.setActiveAmenity);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-ink pb-28 pt-24">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Amenities</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Life at {project.project.name}</h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-neutral-400">Walk through every amenity in navigable 360. Not a video: look around, then follow the arrows on the floor to the next space.</p>

        {/* chip list */}
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {project.amenities.map((a) => (
            <button key={a.id} onClick={() => setActive(a.id)} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] transition hover:bg-white hover:text-black">{a.name.toUpperCase()}</button>
          ))}
        </div>

        {/* grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {project.amenities.map((a, i) => (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => setActive(a.id)}
              className="group relative h-56 overflow-hidden rounded-3xl border border-white/10 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(a.thumb)} alt={a.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-300">{a.level}</div>
                <div className="mt-0.5 text-xl font-semibold">{a.name}</div>
                <div className="text-[12px] text-neutral-300">{a.tagline}</div>
              </div>
              <div className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] backdrop-blur">360°</div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>{active && <Fullscreen360 id={active} onClose={() => setActive(null)} />}</AnimatePresence>
    </div>
  );
}

function Fullscreen360({ id, onClose }: { id: string; onClose: () => void }) {
  const setActive = useAppStore((s) => s.setActiveAmenity);
  const container = useRef<HTMLDivElement>(null);
  const amenity = project.amenities.find((a) => a.id === id)!;
  const [auto, setAuto] = useState(false);

  const hotspots = useMemo<Hotspot[]>(() => {
    const others = project.amenities.filter((a) => a.id !== id);
    return others.map((a, i) => ({ id: `to-${a.id}`, yaw: (i / others.length) * Math.PI * 2 + 0.6, pitch: -0.32, label: a.name, to: a.id }));
  }, [id]);

  const { progress, ready, viewerRef } = usePhotoSphere(container, assetUrl(amenity.pano), hotspots, (to) => setActive(to));

  const toggleAuto = () => {
    const v = viewerRef.current;
    if (!v) return;
    if (auto) v.stopAnimation(); else v.animate({ yaw: v.getPosition().yaw + Math.PI * 2, pitch: v.getPosition().pitch, speed: '2rpm' });
    setAuto(!auto);
  };
  const toggleFs = () => { viewerRef.current?.toggleFullscreen(); };

  return (
    <motion.div className="fixed inset-0 z-50 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div ref={container} className="absolute inset-0" />
      {/* loading bar */}
      {(progress < 100 || !ready) && <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10"><div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.max(8, progress)}%` }} /></div>}

      {/* top-left */}
      <div className="absolute left-5 top-5 z-20 flex items-center gap-3">
        <button onClick={onClose} className="glass grid h-10 w-10 place-items-center rounded-full text-white" aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="glass rounded-full px-4 py-2">
          <div className="text-[11px] font-bold tracking-[0.25em]">{amenity.name.toUpperCase()}</div>
          <div className="text-[10px] tracking-[0.15em] text-neutral-400">{amenity.level} · {amenity.tagline}</div>
        </div>
      </div>
      {/* top-right */}
      <div className="absolute right-5 top-5 z-20 flex gap-2">
        <button onClick={toggleAuto} className={`glass rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.2em] ${auto ? 'bg-white text-black' : 'text-white'}`}>AUTO ROTATE</button>
        <button onClick={toggleFs} className="glass rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.2em] text-white">FULLSCREEN</button>
      </div>
      {/* hint */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-20 text-center text-[11px] tracking-[0.2em] text-white/70">DRAG TO LOOK AROUND · TAP ARROWS TO WALK</div>

      {/* thumbnail strip */}
      <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div className="glass flex gap-2 rounded-2xl p-2">
          {project.amenities.map((a) => (
            <button key={a.id} onClick={() => setActive(a.id)} className={`relative h-16 w-24 overflow-hidden rounded-xl border-2 transition ${a.id === id ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(a.thumb)} alt={a.name} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-bold tracking-[0.2em]">{a.name.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
