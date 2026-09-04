'use client';
import { useAppStore } from '@/store/useAppStore';
import { project, floorLabel, STATUS_COLOR } from '@/lib/data';

const FACING_DEG: Record<string, number> = { North: 0, East: 90, South: 180, West: 270 };

export default function FlatSpecs() {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const statuses = useAppStore((s) => s.statuses);
  const setModule = useAppStore((s) => s.setModule);
  const setLeadOpen = useAppStore((s) => s.setLeadOpen);
  const flat = project.flats.find((f) => f.id === flatId);
  if (!flat) return null;
  const status = statuses[flat.id];
  const tower = project.towers.find((t) => t.id === flat.tower)!;

  return (
    <div className="flex h-full flex-col">
      <div className="p-5 pr-14">
        <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">{tower.name} · Floor {floorLabel(flat.floor)}</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{flat.id}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ background: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />{status}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em]">{flat.bhk} BHK</span>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <div className="rounded-2xl bg-white p-4 text-black">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">All-inclusive price</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">{flat.price}</div>
          <div className="text-[11px] text-neutral-600">≈ ₹{Math.round((flat.priceValue * 1e7) / flat.sqft).toLocaleString('en-IN')} per sqft · registration extra</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Spec label="Carpet area" value={`${flat.sqft} sqft`} />
          <Spec label="Configuration" value={`${flat.bhk} BHK + ${flat.bhk >= 3 ? 'Study' : 'Utility'}`} />
          <Spec label="Facing" value={flat.facing} icon={<svg width="18" height="18" viewBox="0 0 24 24" style={{ transform: `rotate(${FACING_DEG[flat.facing]}deg)` }} fill="none" stroke="#3B82F6" strokeWidth="2.5"><path d="M12 3l5 9h-3v9h-4v-9H7z" /></svg>} />
          <Spec label="Vastu" value={flat.vastu} />
          <Spec label="Natural light" value={flat.naturalLight} />
          <Spec label="Floor" value={flat.floor === 0 ? 'Ground' : `${flat.floor} of ${tower.floors}`} />
        </div>
        <p className="text-[12px] leading-relaxed text-neutral-400">Deck balcony off the living room, {flat.facing.toLowerCase()} facing with uninterrupted views. Two covered car parks and a 5-year maintenance lock-in included.</p>
      </div>
      <div className="space-y-2 border-t border-white/10 p-4">
        <button onClick={() => setModule('tour')} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[12px] font-bold tracking-[0.25em] text-black shadow-glow">
          STEP INSIDE
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
        <div className="flex gap-2">
          <button onClick={() => setLeadOpen(true)} className="flex-1 rounded-full border border-white/15 py-3 text-[11px] font-bold tracking-[0.2em] text-neutral-200 hover:bg-white/5">SCHEDULE VISIT</button>
          <button onClick={() => window.print()} className="flex-1 rounded-full border border-white/15 py-3 text-[11px] font-bold tracking-[0.2em] text-neutral-200 hover:bg-white/5">EXPORT PDF</button>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
      <div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{label}</div>
        <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
      </div>
      {icon}
    </div>
  );
}
