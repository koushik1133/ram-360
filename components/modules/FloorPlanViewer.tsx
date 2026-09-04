'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useAppStore } from '@/store/useAppStore';
import { project, floorLabel, assetUrl, STATUS_COLOR } from '@/lib/data';

type Layer = 'furniture' | 'dimensions' | 'vastu';

export default function FloorPlanViewer() {
  const flatId = useAppStore((s) => s.selectedFlatId);
  const selectFlat = useAppStore((s) => s.selectFlat);
  const setRightOpen = useAppStore((s) => s.setRightOpen);
  const setModule = useAppStore((s) => s.setModule);
  const statuses = useAppStore((s) => s.statuses);
  const flat = project.flats.find((f) => f.id === flatId);
  const host = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  const [svg, setSvg] = useState<string>('');
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ furniture: true, dimensions: true, vastu: false });

  // load SVG plan file from /public/plans (or CDN)
  useEffect(() => {
    if (!flat) return;
    let cancelled = false;
    fetch(assetUrl(flat.planSvg)).then((r) => r.text()).then((t) => { if (!cancelled) setSvg(t); }).catch(() => setSvg(''));
    return () => { cancelled = true; };
  }, [flat?.planSvg, flat]);

  // highlight + layers + click wiring after SVG mounts
  useEffect(() => {
    const root = host.current;
    if (!root || !svg || !flat) return;
    root.querySelectorAll<SVGElement>('.flat').forEach((el) => {
      const no = el.id.replace('flat-', '');
      el.classList.toggle('selected', no === flat.flatNo);
      const sibling = project.flats.find((f) => f.tower === flat.tower && f.floor === flat.floor && f.flatNo === no);
      const dot = root.querySelector<SVGElement>(`#status-${no}`);
      if (dot && sibling) dot.setAttribute('fill', STATUS_COLOR[statuses[sibling.id]]);
      el.onclick = () => { if (sibling) selectFlat(sibling.id); };
    });
    (Object.keys(layers) as Layer[]).forEach((k) => root.querySelector(`#${k}`)?.classList.toggle('hidden-layer', !layers[k]));
    setRightOpen(true);
    requestAnimationFrame(() => zoomRef.current?.centerView(1, 0));
  }, [svg, flat, layers, statuses, selectFlat, setRightOpen]);

  if (!flat) return <EmptyState />;

  return (
    <div className="absolute inset-0 bg-ink">
      <div className="absolute inset-y-0 left-0 right-0 md:right-[400px]">
      <TransformWrapper ref={zoomRef} minScale={0.6} maxScale={5} centerOnInit wheel={{ step: 0.15 }} doubleClick={{ mode: 'zoomIn' }}>
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full grid place-items-center">
          <div ref={host} className="h-[min(68vh,90vw)] w-[min(68vh,90vw)]" dangerouslySetInnerHTML={{ __html: svg }} />
        </TransformComponent>
      </TransformWrapper>
      </div>

      {/* plate */}
      <div className="pointer-events-none absolute left-5 top-24 z-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Floor plan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{flat.id} · {flat.bhk} BHK</h1>
        <p className="mt-1 text-[12px] text-neutral-400">Typical floor {floorLabel(flat.floor)} · Tap any unit to compare · pinch to zoom</p>
      </div>

      {/* tools */}
      <div className="no-print absolute bottom-24 left-5 z-10 flex flex-col gap-2">
        <div className="glass flex gap-1 rounded-full p-1">
          <Tool onClick={() => zoomRef.current?.zoomIn()} label="+" />
          <Tool onClick={() => zoomRef.current?.zoomOut()} label="−" />
          <Tool onClick={() => zoomRef.current?.resetTransform()} label="⟲" />
        </div>
        <div className="glass flex gap-1 rounded-full p-1">
          {(['furniture', 'dimensions', 'vastu'] as Layer[]).map((k) => (
            <button key={k} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] transition ${layers[k] ? 'bg-white text-black' : 'text-neutral-300'}`}>{k.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-24 right-5 z-10 hidden gap-3 text-[10px] tracking-[0.15em] text-neutral-400 md:flex">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-accent bg-accent/30" /> YOUR UNIT</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ring" /> AVAILABLE</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-400" /> RESERVED</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> SOLD</span>
      </div>

      <button onClick={() => setModule('tour')} className="no-print absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-6 py-3 text-[11px] font-bold tracking-[0.25em] text-black shadow-glow md:hidden">STEP INSIDE</button>
    </div>
  );
}

function Tool({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full text-lg text-neutral-200 hover:bg-white hover:text-black">{label}</button>;
}

function EmptyState() {
  const selectFlat = useAppStore((s) => s.selectFlat);
  const setModule = useAppStore((s) => s.setModule);
  const statuses = useAppStore((s) => s.statuses);
  const picks = project.towers.map((t) => project.flats.find((f) => f.tower === t.id && f.floor >= 10 && statuses[f.id] === 'available')).filter(Boolean);
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink p-6">
      <div className="max-w-xl text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Floor plans</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Choose a residence to see its plan</h1>
        <p className="mt-2 text-[13px] text-neutral-400">Select a tower, floor and flat from the inventory, or jump straight into one of today&apos;s most-viewed homes.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {picks.map((f) => f && (
            <button key={f.id} onClick={() => selectFlat(f.id)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white hover:text-black">
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-60">Tower {f.tower} · Floor {f.floor}</div>
              <div className="mt-1 text-lg font-semibold">{f.id}</div>
              <div className="text-[12px] opacity-70">{f.bhk} BHK · {f.sqft} sqft · {f.facing}</div>
              <div className="mt-2 text-[13px] font-semibold">{f.price}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setModule('towers')} className="mt-6 rounded-full border border-white/15 px-6 py-3 text-[11px] font-bold tracking-[0.25em] text-neutral-200 hover:bg-white/5">BROWSE INVENTORY</button>
      </div>
    </div>
  );
}
