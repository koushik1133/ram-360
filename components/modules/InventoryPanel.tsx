'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { project, floorLabel, STATUS_COLOR } from '@/lib/data';
import { SFT_COLOR, UNIT_SQFTS } from '@/lib/palette';
import type { Flat } from '@/lib/types';

export default function InventoryPanel() {
  const selectedTowerId = useAppStore((s) => s.selectedTower);
  const towerId = selectedTowerId && project.towers.some((t) => t.id === selectedTowerId) ? selectedTowerId : project.towers[0].id;
  const selectTower = useAppStore((s) => s.selectTower);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectFloor = useAppStore((s) => s.selectFloor);
  const selectedFlat = useAppStore((s) => s.selectedFlatId);
  const selectFlat = useAppStore((s) => s.selectFlat);
  const setModule = useAppStore((s) => s.setModule);
  const statuses = useAppStore((s) => s.statuses);
  const search = useAppStore((s) => s.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const bhk = useAppStore((s) => s.bhkFilter);
  const sqftFilter = useAppStore((s) => s.sqftFilter);
  const setSqftFilter = useAppStore((s) => s.setSqftFilter);
  const statusFilter = useAppStore((s) => s.statusFilter);
  const listRef = useRef<VirtuosoHandle>(null);

  const tower = project.towers.find((t) => t.id === towerId)!;
  const flats = useMemo(() => project.flats.filter((f) => f.tower === towerId), [towerId]);

  const matches = (f: Flat) => {
    const q = search.trim().toLowerCase().replace(/\s+/g, '');
    if (q && !f.id.toLowerCase().replace('-', '').includes(q.replace('-', '')) && !`${floorLabel(f.floor)}${f.flatNo}`.toLowerCase().includes(q)) return false;
    if (bhk && f.bhk !== bhk) return false;
    if (sqftFilter && f.sqft !== sqftFilter) return false;
    if (statusFilter && statuses[f.id] !== statusFilter) return false;
    return true;
  };
  const filtering = !!search.trim() || !!bhk || !!sqftFilter || !!statusFilter;
  const floors = useMemo(() => {
    const all = Array.from({ length: tower.floors + 1 }, (_, i) => tower.floors - i);
    return filtering ? all.filter((fl) => flats.some((f) => f.floor === fl && matches(f))) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower.floors, flats, search, bhk, sqftFilter, statusFilter, statuses]);

  const counts = { available: 0, sold: 0, reserved: 0 } as Record<string, number>;
  flats.forEach((f) => { counts[statuses[f.id]] = (counts[statuses[f.id]] ?? 0) + 1; });

  useEffect(() => {
    if (selectedFloor === null) return;
    const idx = floors.indexOf(selectedFloor);
    if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' });
  }, [selectedFloor, floors]);

  return (
    <div className="flex h-full flex-col">
      {/* Tower tabs */}
      <div className="flex gap-1 p-3 pr-14">
        {project.towers.map((t) => (
          <button key={t.id} onClick={() => selectTower(t.id)} className={`flex-1 rounded-xl py-2 text-[11px] font-bold tracking-[0.2em] transition ${t.id === towerId ? 'bg-white text-black' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}`}>{t.name.toUpperCase()}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1 px-3">
        <Stat label="Floors" value={`G–${tower.floors}`} />
        <Stat label="Units" value={String(tower.units)} />
        <Stat label="Status" value={tower.status} />
      </div>
      <div className="mt-2 flex items-center gap-3 px-4 text-[10px] tracking-[0.15em] text-neutral-400">
        {(['available', 'reserved', 'sold'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />{counts[s]} {s.toUpperCase()}</span>
        ))}
      </div>

      {/* Search + BHK filter */}
      <div className="space-y-2 p-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flat · e.g. 1203 or T2-1203" className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-[13px] outline-none placeholder:text-neutral-600 focus:border-accent" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setSqftFilter(null)} className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.18em] transition ${sqftFilter === null ? 'bg-white text-black' : 'bg-white/10 text-neutral-300'}`}>ALL SFT</button>
          {UNIT_SQFTS.map((sqft) => (
            <button key={sqft} onClick={() => setSqftFilter(sqftFilter === sqft ? null : sqft)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] transition ${sqftFilter === sqft ? 'bg-white text-black' : 'bg-white/10 text-neutral-300'}`}>
              <span className="h-2 w-2 rounded-[2px]" style={{ background: SFT_COLOR[sqft] }} />{sqft}
            </button>
          ))}
        </div>
      </div>

      {/* Floor list (virtualised) */}
      <div className="min-h-0 flex-1">
        {floors.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-neutral-500">No residences match. Clear filters to see all {tower.units} units.</p>
        ) : (
          <Virtuoso
            ref={listRef}
            style={{ height: '100%' }}
            data={floors}
            itemContent={(_, floor) => {
              const rows = flats.filter((f) => f.floor === floor);
              const shown = filtering ? rows.filter(matches) : rows;
              const avail = rows.filter((f) => statuses[f.id] === 'available').length;
              const open = selectedFloor === floor;
              return (
                <div className="px-3 pb-1.5">
                  <button onClick={() => selectFloor(open ? null : floor)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${open ? 'bg-white text-black' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
                    <span className="flex items-center gap-3">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg text-[12px] font-bold ${open ? 'bg-black text-white' : 'bg-white/10'}`}>{floorLabel(floor)}</span>
                      <span className="text-[12px] font-semibold tracking-wide">{floor === 0 ? 'Ground floor' : `Floor ${floor}`}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1">{rows.map((f) => <span key={f.id} className="h-1.5 w-1.5 rounded-[2px]" style={{ background: SFT_COLOR[f.sqft] }} title={`${f.flatNo} · ${f.sqft} SFT`} />)}</span>
                      <span className={`text-[10px] tracking-[0.15em] ${open ? 'text-neutral-600' : 'text-neutral-400'}`}>{avail}/{rows.length}</span>
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="space-y-1 pt-1.5">
                          {shown.map((f) => {
                            const st = statuses[f.id];
                            const sel = selectedFlat === f.id;
                            return (
                              <div key={f.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${sel ? 'border-accent bg-accent/15' : 'border-white/5 bg-black/30 hover:border-white/15'}`}>
                                <button onClick={() => selectFlat(f.id)} className="flex flex-1 items-center gap-3 text-left">
                                  <span className="h-3 w-3 rounded-[3px] border border-white/10" style={{ background: SFT_COLOR[f.sqft] }} />
                                  <span className="text-[12px] font-bold">Flat {f.flatNo}</span>
                                  <span className="text-[11px] text-neutral-300">{f.bhk} BHK</span>
                                  <span className="text-[11px] text-neutral-400">{f.sqft} SFT</span>
                                  <span className="text-[11px] text-neutral-400">{f.facing[0]}</span>
                                  <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold capitalize" style={{ color: STATUS_COLOR[st] }}><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[st] }} />{st}</span>
                                </button>
                                <button onClick={() => { selectFlat(f.id); setModule('plans'); }} title="Open floor plan" className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-neutral-300 hover:bg-white hover:text-black">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }}
          />
        )}
      </div>

      {selectedFlat && (
        <div className="border-t border-white/10 p-3">
          <button onClick={() => setModule('plans')} className="w-full rounded-full bg-white py-3 text-[11px] font-bold tracking-[0.25em] text-black">VIEW FLOOR PLAN · {selectedFlat}</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold">{value}</div>
    </div>
  );
}
