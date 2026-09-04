'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { analytics } from '@/lib/analytics';
import { project } from '@/lib/data';

export default function LeadForm() {
  const open = useAppStore((s) => s.leadOpen);
  const setOpen = useAppStore((s) => s.setLeadOpen);
  const flatId = useAppStore((s) => s.selectedFlatId);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, unit: flatId ?? undefined, engagement: analytics.summary() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Something went wrong');
      analytics.track('lead_submitted', { unit: flatId });
      setState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const close = () => { setOpen(false); setTimeout(() => setState('idle'), 300); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="lead" className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-panel p-6 shadow-glow"
          >
            {state === 'done' ? (
              <div className="py-6 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ring/20 text-ring">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="mt-4 text-xl font-semibold">Visit requested</h3>
                <p className="mt-2 text-[13px] text-neutral-400">A {project.project.developer} relationship manager will call you within the hour to confirm your slot{flatId ? ` for ${flatId}` : ''}.</p>
                <button onClick={close} className="mt-6 w-full rounded-full bg-white py-3 text-[12px] font-semibold tracking-[0.2em] text-black">CONTINUE EXPLORING</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">Schedule a site visit</p>
                  <h3 className="mt-1 text-xl font-semibold">See {flatId ?? project.project.name} in person</h3>
                  <p className="mt-1 text-[12px] text-neutral-400">Private walkthrough of the show apartment and the exact unit on the facade.</p>
                </div>
                <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ananya Rao" required />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+91 98765 43210" type="tel" required />
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="ananya@example.com" type="email" required />
                <Field label="Preferred time (optional)" value={form.message} onChange={(v) => setForm({ ...form, message: v })} placeholder="Saturday morning" />
                {error && <p className="text-[12px] text-red-400">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={close} className="flex-1 rounded-full border border-white/15 py-3 text-[12px] font-semibold tracking-[0.2em] text-neutral-300 hover:bg-white/5">CANCEL</button>
                  <button type="submit" disabled={state === 'sending'} className="flex-1 rounded-full bg-white py-3 text-[12px] font-semibold tracking-[0.2em] text-black disabled:opacity-60">{state === 'sending' ? 'SENDING…' : 'REQUEST VISIT'}</button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-600 focus:border-accent"
      />
    </label>
  );
}
