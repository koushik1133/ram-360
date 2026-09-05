'use client';
import { SFT_COLOR, SFT_TYPE, UNIT_SQFTS } from '@/lib/palette';

export default function SftLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`glass flex flex-wrap items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-neutral-200 ${compact ? '' : 'sm:gap-3'}`}>
      <span className="text-neutral-500">SFT</span>
      {UNIT_SQFTS.map((sqft) => (
        <span key={sqft} className="flex items-center gap-1.5" title={SFT_TYPE[sqft]}>
          <span className="h-2.5 w-2.5 rounded-[3px] border border-black/20" style={{ background: SFT_COLOR[sqft] }} />
          {sqft}
        </span>
      ))}
    </div>
  );
}
