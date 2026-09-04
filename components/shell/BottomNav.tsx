'use client';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import type { ModuleId } from '@/lib/types';

const PILLS: { id: ModuleId; label: string }[] = [
  { id: 'master', label: 'MASTER PLAN' },
  { id: 'location', label: 'LOCATION' },
  { id: 'amenities', label: 'AMENITIES' },
  { id: 'towers', label: 'TOWERS' },
  { id: 'plans', label: 'PLANS' },
];

export default function BottomNav() {
  const module = useAppStore((s) => s.module);
  const setModule = useAppStore((s) => s.setModule);

  const go = (id: ModuleId) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
    setModule(id);
  };

  return (
    <nav className="no-print pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-3 sm:bottom-5 sm:px-4">
      <div className="pointer-events-auto glass flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 shadow-glow sm:gap-1 sm:p-1.5 [scrollbar-width:none]">
        {PILLS.map((p) => {
          const active = module === p.id || (module === 'tour' && p.id === 'plans');
          return (
            <button
              key={p.id}
              onClick={() => go(p.id)}
              className={`relative shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-[9.5px] font-semibold tracking-[0.14em] transition-colors duration-300 sm:px-4 sm:py-2.5 sm:text-[11px] sm:tracking-[0.18em] md:px-5 md:text-[12px] ${active ? 'text-black' : 'text-neutral-300 hover:text-white'}`}
            >
              {active && (
                <motion.span
                  layoutId="pill-active"
                  className="absolute inset-0 rounded-full bg-white"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{p.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
