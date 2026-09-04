'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { project, assetUrl } from '@/lib/data';
import { analytics } from '@/lib/analytics';
import type { RoomId } from '@/lib/types';
import { usePhotoSphere, type Hotspot } from './usePhotoSphere';

export default function VirtualTour() {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const room = useAppStore((s) => s.room);
  const setRoom = useAppStore((s) => s.setRoom);
  const setModule = useAppStore((s) => s.setModule);
  const setLeadOpen = useAppStore((s) => s.setLeadOpen);
  const container = useRef<HTMLDivElement>(null);
  const flat = project.flats.find((f) => f.id === flatId) ?? project.flats.find((f) => f.status === 'available')!;
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    analytics.track('tour_entered', { flat: flat.id });
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [flat.id]);

  const hotspots = useMemo<Hotspot[]>(() => {
    const others = project.rooms.filter((r) => r.id !== room);
    return others.map((r, i) => ({ id: `to-${r.id}`, yaw: (i / others.length) * Math.PI * 2 + 0.4, pitch: -0.28, label: r.label, to: r.id }));
  }, [room]);

  const { yaw, progress, ready } = usePhotoSphere(container, assetUrl(flat.panos[room]), hotspots, (to) => setRoom(to as RoomId));
  const current = project.rooms.find((r) => r.id === room)!;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div className="absolute inset-0 bg-black">
      <div ref={container} className="absolute inset-0" />
      {(progress < 100 || !ready) && <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10"><div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.max(8, progress)}%` }} /></div>}

      {/* top-left: back + context */}
      <div className="absolute left-5 top-5 z-20 flex items-center gap-3">
        <button onClick={() => setModule('plans')} className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-bold tracking-[0.2em] text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>FLOOR PLAN
        </button>
        <div className="glass rounded-full px-4 py-2">
          <div className="text-[11px] font-bold tracking-[0.25em]">{flat.id} · {current.label}</div>
          <div className="text-[10px] tracking-[0.15em] text-neutral-400">{flat.bhk} BHK · {flat.sqft} sqft · {flat.facing} facing · {flat.price}</div>
        </div>
        <div className="glass hidden rounded-full px-3 py-2 font-mono text-[11px] text-neutral-300 sm:block" title="Time inside this home">IN HOME {mm}:{ss}</div>
      </div>

      {/* top-right minimap */}
      <Minimap room={room} yaw={yaw} onPick={(r) => setRoom(r)} />

      {/* bottom room pills */}
      <div className="absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
        <div className="hidden sm:block sm:w-56" />
        <div className="glass flex gap-1 rounded-full p-1.5">
          {project.rooms.map((r) => (
            <button key={r.id} onClick={() => setRoom(r.id)} className={`rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.18em] transition ${room === r.id ? 'bg-white text-black' : 'text-neutral-300 hover:text-white'}`}>{r.label}</button>
          ))}
        </div>
        <div className="flex gap-2 sm:w-56 sm:justify-end">
          <button onClick={() => setLeadOpen(true)} className="rounded-full bg-white px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-black shadow-glow">SCHEDULE VISIT</button>
          <button onClick={() => setLeadOpen(true)} className="glass rounded-full px-4 py-2.5 text-[11px] font-bold tracking-[0.2em] text-white">REQUEST QUOTE</button>
        </div>
      </div>
    </div>
  );
}

function Minimap({ room, yaw, onPick }: { room: RoomId; yaw: number; onPick: (r: RoomId) => void }) {
  const pos = project.rooms.find((r) => r.id === room)!.minimap;
  const deg = (yaw * 180) / Math.PI;
  return (
    <div className="glass absolute right-5 top-5 z-20 w-44 rounded-2xl p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-[9px] uppercase tracking-[0.25em] text-neutral-400"><span>You are here</span><span>N ↑</span></div>
      <svg viewBox="0 0 100 100" className="h-32 w-full">
        {/* rooms */}
        <g fill="#1d1d1d" stroke="#3a3a3a" strokeWidth="1">
          <rect x="4" y="8" width="36" height="44" onClick={() => onPick('bedroom')} className="cursor-pointer" />
          <rect x="44" y="8" width="30" height="44" onClick={() => onPick('dining')} className="cursor-pointer" />
          <rect x="78" y="8" width="18" height="44" onClick={() => onPick('kitchen')} className="cursor-pointer" />
          <rect x="4" y="56" width="92" height="24" onClick={() => onPick('living')} className="cursor-pointer" />
          <rect x="30" y="82" width="64" height="14" onClick={() => onPick('balcony')} className="cursor-pointer" />
        </g>
        <g fill="#6b6b6b" fontSize="6" fontWeight="700" pointerEvents="none">
          <text x="7" y="14">BED</text><text x="47" y="14">DINE</text><text x="80" y="14">KIT</text><text x="7" y="62">LIVING</text><text x="33" y="90">BALCONY</text>
        </g>
        {/* view cone + dot */}
        <g style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)' }}>
          <g transform={`rotate(${deg})`}>
            <path d="M0 0 L-9 -16 A18 18 0 0 1 9 -16 Z" fill="#3b82f6" fillOpacity="0.35" />
          </g>
          <circle r="3.2" fill="#3b82f6" stroke="#fff" strokeWidth="1.2" />
        </g>
      </svg>
    </div>
  );
}
