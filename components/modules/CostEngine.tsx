'use client';

import { useMemo } from 'react';
import { project } from '@/lib/data';
import { calculateInteriorQuote, TIER_LABEL, TIER_RATE } from '@/lib/pricing';
import { useAppStore } from '@/store/useAppStore';
import type { FinishTier } from '@/lib/types';

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export default function CostEngine() {
  const selectedFlatId = useAppStore((state) => state.selectedFlatId);
  const selectFlat = useAppStore((state) => state.selectFlat);
  const tier = useAppStore((state) => state.finishTier);
  const setTier = useAppStore((state) => state.setFinishTier);
  const setModule = useAppStore((state) => state.setModule);
  const setRoom = useAppStore((state) => state.setRoom);
  const setLeadOpen = useAppStore((state) => state.setLeadOpen);
  const flat = project.flats.find((item) => item.id === selectedFlatId) ?? project.flats.find((item) => item.sqft === 1585)!;
  const quote = useMemo(() => calculateInteriorQuote(flat.sqft, tier), [flat.sqft, tier]);

  const openRoom = (room: keyof typeof quote.rooms) => {
    setRoom(room);
    setModule('tour');
  };

  return (
    <main className="absolute inset-0 overflow-y-auto bg-[#eeeae1] px-4 pb-28 pt-24 text-[#211f1a] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#95733b]">Interior cost studio · live estimate</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Plan your home before possession.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b655b]">A transparent planning estimate for {flat.id}. Final pricing requires site measurement, material confirmation and a signed scope.</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#766f65]">Apartment</label>
            <select value={flat.id} onChange={(event) => selectFlat(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-semibold outline-none">
              {project.flats.filter((item) => item.floor === 15 && item.tower === 'D').map((item) => <option key={item.id} value={item.id}>{item.id} · {item.sqft} SFT</option>)}
            </select>
          </div>
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-[28px] bg-[#191815] p-5 text-white shadow-2xl sm:p-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Estimated project total</p>
                <div className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{money(quote.total)}</div>
                <p className="mt-2 text-xs text-white/45">Base scope {money(quote.base)} · {money(TIER_RATE[tier])}/sqft planning rate</p>
              </div>
              <div className="flex rounded-full bg-white/8 p-1">
                {(['essential', 'signature', 'luxury'] as FinishTier[]).map((item) => <button key={item} onClick={() => setTier(item)} className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] ${tier === item ? 'bg-[#d4ae6b] text-black' : 'text-white/60 hover:text-white'}`}>{item}</button>)}
              </div>
            </div>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              <Breakdown label="Base fabrication" value={quote.breakdown.base} />
              <Breakdown label="Hardware · 8%" value={quote.breakdown.hardware} />
              <Breakdown label="Factory + delivery · 9%" value={quote.breakdown.factoryDelivery} />
              <Breakdown label="Door finishing · 10%" value={quote.breakdown.doorFinishing} />
              <Breakdown label="Installation · 9.84%" value={quote.breakdown.installation} />
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/55">{TIER_LABEL[tier]} includes a representative material allowance. Taxes, appliances, loose furniture and civil changes are excluded.</div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white/75 p-5 shadow-sm sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#81786c]">Room-wise allocation</p>
            <div className="mt-4 space-y-2">
              {project.rooms.map((room) => (
                <button key={room.id} onClick={() => openRoom(room.id)} className="flex w-full items-center justify-between rounded-2xl border border-black/8 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <span><strong className="block text-sm">{room.label}</strong><span className="text-[10px] uppercase tracking-[0.16em] text-[#8a8277]">Open 360° room</span></span>
                  <span className="font-semibold">{money(quote.rooms[room.id])}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => setModule('plans')} className="rounded-full border border-black/15 bg-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Review floor plan</button>
          <button onClick={() => setLeadOpen(true)} className="rounded-full bg-[#191815] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white">Generate detailed quote</button>
        </div>
      </div>
    </main>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="block text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</span><strong className="mt-1 block text-lg">{money(value)}</strong></div>;
}
