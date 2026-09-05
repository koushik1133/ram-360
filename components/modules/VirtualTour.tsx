'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { project } from '@/lib/data';
import { analytics } from '@/lib/analytics';
import { buildUnitLayout, spaceForRoom, tourSpaces, type Space, type UnitLayout } from '@/lib/apartments';

const Room360 = dynamic(() => import('./interior/Room360'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#161412] text-[11px] font-bold tracking-[0.28em] text-white/55">
      ENTERING THE HOME
    </div>
  ),
});

export default function VirtualTour() {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const room = useAppStore((s) => s.room);
  const spaceKey = useAppStore((s) => s.spaceKey);
  const setSpace = useAppStore((s) => s.setSpace);
  const setModule = useAppStore((s) => s.setModule);
  const setLeadOpen = useAppStore((s) => s.setLeadOpen);

  const flat = project.flats.find((f) => f.id === flatId) ?? project.flats.find((f) => f.status === 'available')!;
  const layout = useMemo(() => buildUnitLayout(flat.sqft, Number(flat.flatNo) > 5), [flat.sqft, flat.flatNo]);
  const spaces = useMemo(() => tourSpaces(layout), [layout]);
  const active = useMemo(() => spaces.find((s) => s.key === spaceKey) ?? spaceForRoom(layout, room), [spaces, spaceKey, layout, room]);

  const [secs, setSecs] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [bare, setBare] = useState(false);
  const [yaw, setYaw] = useState(0);

  useEffect(() => {
    analytics.track('tour_entered', { flat: flat.id, space: active.key });
  }, [flat.id, active.key]);

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sync = () => {
      const on = Boolean(document.fullscreenElement);
      setFullscreen(on);
      if (!on) setBare(false);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setBare((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  const enter = useCallback((space: Space) => setSpace(space.key, space.room), [setSpace]);
  const handleYaw = useCallback((v: number) => setYaw(v), []);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const chrome = !bare;

  return (
    <div className="absolute inset-0 bg-black">
      <Room360 layout={layout} active={active} onEnter={enter} onYaw={handleYaw} />

      {chrome && (
        <>
          <div className="absolute left-5 top-5 z-[1000] flex flex-wrap items-center gap-3">
            <button
              onClick={() => setModule('plans')}
              className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-bold tracking-[0.2em] text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              FLOOR PLAN
            </button>
            <div className="glass rounded-full px-4 py-2">
              <div className="text-[11px] font-bold tracking-[0.25em]">{flat.id} · {active.label.toUpperCase()}</div>
              <div className="text-[10px] tracking-[0.15em] text-neutral-400">
                {active.dim} · {active.sqft} sft · {flat.sqft} SFT {flat.bhk} BHK · {flat.facing} facing
              </div>
            </div>
            <div className="glass hidden rounded-full px-3 py-2 font-mono text-[11px] text-neutral-300 sm:block" title="Time inside this home">
              IN HOME {mm}:{ss}
            </div>
          </div>

          <PlanMinimap layout={layout} active={active} yaw={yaw} onPick={enter} />

          <div className="absolute right-5 top-[196px] z-[1000] flex flex-col gap-1.5">
            <button
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen tour"
              title="Fullscreen"
              className="glass grid h-11 w-11 place-items-center rounded-full text-lg text-white"
            >
              {fullscreen ? '↙' : '↗'}
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
                setBare(true);
              }}
              aria-label="Drag only mode"
              title="Drag-only mode (press H to bring the panel back)"
              className="glass grid h-11 w-11 place-items-center rounded-full text-[10px] font-bold tracking-wide text-white"
            >
              DRAG
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-6 z-[1000] flex flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
            <div className="hidden sm:block sm:w-56" />
            <div className="glass flex max-w-[calc(100vw-2rem)] gap-1 overflow-x-auto rounded-full p-1.5">
              {spaces.map((s) => (
                <button
                  key={s.key}
                  onClick={() => enter(s)}
                  className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.16em] transition ${
                    active.key === s.key ? 'bg-white text-black' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {s.short}
                </button>
              ))}
            </div>
            <div className="flex gap-2 sm:w-56 sm:justify-end">
              <button
                onClick={() => setLeadOpen(true)}
                className="rounded-full bg-white px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-black shadow-glow"
              >
                SCHEDULE VISIT
              </button>
              <button onClick={() => setLeadOpen(true)} className="glass rounded-full px-4 py-2.5 text-[11px] font-bold tracking-[0.2em] text-white">
                REQUEST QUOTE
              </button>
            </div>
          </div>
        </>
      )}

      {!chrome && (
        <button
          onClick={() => setBare(false)}
          className="absolute right-5 top-5 z-[1000] rounded-full bg-black/50 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-white/70 backdrop-blur hover:text-white"
        >
          SHOW PANEL · H
        </button>
      )}
    </div>
  );
}

/** Minimap drawn from the real unit plan, with a live view cone. */
function PlanMinimap({
  layout,
  active,
  yaw,
  onPick,
}: {
  layout: UnitLayout;
  active: Space;
  yaw: number;
  onPick: (space: Space) => void;
}) {
  const scale = 172 / Math.max(layout.width, layout.depth);
  const w = layout.width * scale;
  const h = layout.depth * scale;
  const cx = (active.x + active.w / 2) * scale;
  const cy = (active.z + active.d / 2) * scale;
  const deg = (yaw * 180) / Math.PI;

  return (
    <div className="glass absolute right-5 top-5 z-[1000] w-[196px] rounded-2xl p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-0.5 text-[9px] uppercase tracking-[0.22em] text-neutral-400">
        <span>You are here</span>
        <span>N ↑</span>
      </div>
      <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} className="w-full">
        {layout.spaces.map((s) => {
          const on = s.key === active.key;
          return (
            <g key={s.key} onClick={() => s.tourable && onPick(s)} className={s.tourable ? 'cursor-pointer' : ''}>
              <rect
                x={s.x * scale}
                y={s.z * scale}
                width={s.w * scale}
                height={s.d * scale}
                fill={on ? '#f5c045' : s.tourable ? '#242424' : '#171717'}
                stroke={on ? '#ffe6a8' : '#3d3d3d'}
                strokeWidth={on ? 1.6 : 0.8}
              />
              {s.w * scale > 26 && s.d * scale > 12 && (
                <text
                  x={s.x * scale + (s.w * scale) / 2}
                  y={s.z * scale + (s.d * scale) / 2 + 2.4}
                  textAnchor="middle"
                  fontSize="5.4"
                  fontWeight="700"
                  fill={on ? '#1a1a1a' : '#7b7b7b'}
                  pointerEvents="none"
                >
                  {s.short}
                </text>
              )}
            </g>
          );
        })}
        <g style={{ transform: `translate(${cx}px, ${cy}px)`, transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)' }}>
          <g transform={`rotate(${180 - deg})`}>
            <path d="M0 0 L-11 -21 A24 24 0 0 1 11 -21 Z" fill="#c4a057" fillOpacity="0.45" />
          </g>
          <circle r="3.4" fill="#c4a057" stroke="#fff" strokeWidth="1.3" />
        </g>
      </svg>
      <div className="mt-1 px-0.5 text-[9px] uppercase tracking-[0.14em] text-neutral-500">
        {layout.sqft} SFT · {layout.typeName}
      </div>
    </div>
  );
}
