export default function Shimmer({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink">
      <div className="w-72 space-y-3">
        <div className="shimmer h-40 rounded-2xl" />
        <div className="shimmer h-4 w-2/3 rounded" />
        <div className="shimmer h-4 w-1/2 rounded" />
        <p className="pt-2 text-center text-[11px] uppercase tracking-[0.25em] text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
