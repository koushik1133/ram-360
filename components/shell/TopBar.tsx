'use client';
import { useEffect, useState } from 'react';
import { project } from '@/lib/data';
import { useAppStore } from '@/store/useAppStore';

function useSessionClock() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function TopBar({ realtime }: { realtime: 'live' | 'demo' | 'connecting' }) {
  const clock = useSessionClock();
  const module = useAppStore((s) => s.module);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const sync = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().then(() => setFs(true)).catch(() => {});
    else document.exitFullscreen?.().then(() => setFs(false));
  };

  return (
    <header className="no-print pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4">
      {/* Logo */}
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l19-9-9 19-2-8-8-2z" />
          </svg>
        </div>
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-[0.24em]">ORION 360</div>
          <div className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-neutral-400">Buyer digital twin</div>
        </div>
      </div>

      {/* Project title */}
      <div className="pointer-events-auto glass hidden rounded-full px-5 py-2 text-center md:block">
        <div className="text-[13px] font-semibold tracking-[0.3em]">{project.project.name}</div>
        <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-neutral-400">{project.project.address}<span className="hidden lg:inline"> · RERA {project.project.rera}</span></div>
      </div>

      {/* Status cluster */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-neutral-300" title={realtime === 'live' ? 'Live inventory' : 'Demo inventory'}>
          <span className={`h-2 w-2 rounded-full ${realtime === 'live' ? 'bg-ring' : realtime === 'demo' ? 'bg-yellow-400' : 'bg-neutral-500'}`} />
          <span className="hidden whitespace-nowrap sm:inline">{realtime === 'live' ? 'Live inventory' : realtime === 'demo' ? 'Demo inventory' : 'Connecting'}</span>
        </div>
        <div className="glass hidden rounded-full px-3 py-1.5 font-mono text-[11px] text-neutral-300 sm:block" title="Engagement time">{clock}</div>
        <button onClick={toggleFullscreen} className="glass grid h-9 w-9 place-items-center rounded-full text-neutral-300 hover:text-white" aria-label="Toggle fullscreen">
          {fs ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" /></svg>
          )}
        </button>
        <span className="sr-only">{module}</span>
      </div>
    </header>
  );
}
