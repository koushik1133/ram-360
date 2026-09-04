'use client';
import { useAppStore } from '@/store/useAppStore';
import { project, CATEGORY_ICON } from '@/lib/data';

export default function PoiCard() {
  const id = useAppStore((s) => s.selectedPoiId);
  const poi = project.pois.find((p) => p.id === id);
  if (!poi) return null;
  const stars = Math.round(poi.rating);
  return (
    <div className="flex h-full flex-col">
      <div className="relative h-48 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poi.image} alt={poi.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-pin px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white">{CATEGORY_ICON[poi.category]} {poi.category.toUpperCase()}</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div>
          <h3 className="text-lg font-semibold leading-tight">{poi.name}</h3>
          <div className="mt-1 flex items-center gap-1 text-[12px] text-yellow-400">
            {'★'.repeat(stars)}<span className="text-neutral-600">{'★'.repeat(5 - stars)}</span>
            <span className="ml-1 text-neutral-400">{poi.rating.toFixed(1)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Distance" value={poi.distance < 1 ? `${Math.round(poi.distance * 1000)} m` : `${poi.distance} km`} />
          <Stat label="Drive time" value={`${poi.travelMins} mins`} />
        </div>
        <p className="text-[13px] leading-relaxed text-neutral-300">{poi.description}</p>
        <div className="rounded-xl border border-line bg-white/[0.03] p-3 text-[11px] text-neutral-400">
          <span className="mr-2 inline-block h-2 w-6 rounded-full bg-accent align-middle" />Blue route is live driving directions from {poi.name} to {project.project.name}.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
