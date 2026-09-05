'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { project, CATEGORIES, CATEGORY_ICON, STATUS_COLOR } from '@/lib/data';
import { SFT_COLOR, UNIT_SQFTS } from '@/lib/palette';
import type { PoiCategory } from '@/lib/types';

function LocationFilters() {
  const categories = useAppStore((s) => s.categories);
  const toggle = useAppStore((s) => s.toggleCategory);
  const distance = useAppStore((s) => s.distanceFilter);
  const counts = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
    acc[c] = project.pois.filter((p) => p.category === c && (distance === null || p.distance <= distance)).length;
    return acc;
  }, {});
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">Location intelligence</p>
        <h2 className="mt-1 text-lg font-semibold">What surrounds {project.project.name}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">Toggle a category to drop live pins. Tap any pin for drive time and route.</p>
      </div>
      <ul className="space-y-1.5">
        {CATEGORIES.map((c) => (
          <li key={c}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-line hover:bg-white/5">
              <input type="checkbox" checked={categories[c as PoiCategory]} onChange={() => toggle(c as PoiCategory)} className="h-4 w-4 accent-pin" />
              <span className="text-lg leading-none">{CATEGORY_ICON[c]}</span>
              <span className="flex-1 text-[13px] font-medium">{c}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-neutral-300">{counts[c]}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-line bg-white/[0.03] p-3 text-[12px] text-neutral-400">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-ring" /> Concentric rings mark 500 m, 1 km and 2 km walkable radius.</div>
      </div>
    </div>
  );
}

function TowerFilters() {
  const selectedTower = useAppStore((s) => s.selectedTower);
  const selectTower = useAppStore((s) => s.selectTower);
  const statuses = useAppStore((s) => s.statuses);
  const sqftFilter = useAppStore((s) => s.sqftFilter);
  const setSqftFilter = useAppStore((s) => s.setSqftFilter);
  const statusFilter = useAppStore((s) => s.statusFilter);
  const setStatusFilter = useAppStore((s) => s.setStatusFilter);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">Inventory</p>
        <h2 className="mt-1 text-lg font-semibold">{project.project.name} · {project.project.totalUnits} residences</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">{project.project.tagline} Possession {project.project.possession}.</p>
      </div>
      <div className="space-y-2">
        {project.towers.map((t) => {
          const flats = project.flats.filter((f) => f.tower === t.id);
          const avail = flats.filter((f) => statuses[f.id] === 'available').length;
          const active = selectedTower === t.id;
          return (
            <button key={t.id} onClick={() => selectTower(t.id)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? 'border-white bg-white text-black' : 'border-line bg-white/[0.03] hover:bg-white/[0.07]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold tracking-wide">{t.name}</span>
                <span className={`text-[10px] uppercase tracking-[0.18em] ${active ? 'text-neutral-600' : 'text-neutral-400'}`}>{t.status}</span>
              </div>
              <div className={`mt-1 text-[11px] ${active ? 'text-neutral-700' : 'text-neutral-400'}`}>G–{t.floors} · {t.shape === 'bar' ? 'Linear plate' : 'Cross plate'} · <span className={active ? 'font-semibold' : 'text-ring'}>{avail} available</span></div>
            </button>
          );
        })}
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-neutral-500">Saleable area</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setSqftFilter(null)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wider transition ${sqftFilter === null ? 'bg-white text-black' : 'bg-white/10 text-neutral-300 hover:bg-white/20'}`}>All SFT</button>
          {UNIT_SQFTS.map((sqft) => (
            <button key={sqft} onClick={() => setSqftFilter(sqftFilter === sqft ? null : sqft)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wider transition ${sqftFilter === sqft ? 'bg-white text-black' : 'bg-white/10 text-neutral-300 hover:bg-white/20'}`}>
              <span className="h-2 w-2 rounded-[2px]" style={{ background: SFT_COLOR[sqft] }} />{sqft}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-neutral-500">Availability</p>
        <div className="flex flex-wrap gap-1.5">
          {([null, 'available', 'reserved', 'sold'] as const).map((s) => (
            <button key={String(s)} onClick={() => setStatusFilter(s)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize tracking-wider transition ${statusFilter === s ? 'bg-white text-black' : 'bg-white/10 text-neutral-300 hover:bg-white/20'}`}>
              {s && <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />}{s ?? 'All'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LeftDrawer() {
  const module = useAppStore((s) => s.module);
  const open = useAppStore((s) => s.leftOpen);
  const setOpen = useAppStore((s) => s.setLeftOpen);
  const hasDrawer = module === 'location' || module === 'master' || module === 'towers';
  if (!hasDrawer) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            key="left"
            initial={{ x: -340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -340, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="no-print glass absolute bottom-24 left-3 top-16 z-30 w-[min(300px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl p-5 sm:left-4 sm:top-20"
          >
            {module === 'location' ? <LocationFilters /> : <TowerFilters />}
          </motion.aside>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle filters"
        className={`no-print glass absolute top-1/2 z-30 grid h-12 w-8 -translate-y-1/2 place-items-center rounded-r-xl text-neutral-300 transition-all duration-300 hover:text-white ${open ? 'left-[min(316px,calc(100vw-1.5rem))]' : 'left-0'}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </>
  );
}
