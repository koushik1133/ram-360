'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import InventoryPanel from '@/components/modules/InventoryPanel';
import PoiCard from '@/components/modules/PoiCard';
import FlatSpecs from '@/components/modules/FlatSpecs';

export default function RightPanel() {
  const module = useAppStore((s) => s.module);
  const open = useAppStore((s) => s.rightOpen);
  const setOpen = useAppStore((s) => s.setRightOpen);
  const selectedTower = useAppStore((s) => s.selectedTower);
  const selectedPoi = useAppStore((s) => s.selectedPoiId);
  const selectedFlat = useAppStore((s) => s.selectedFlatId);

  let content: React.ReactNode = null;
  let key = '';
  if ((module === 'master' || module === 'towers') && selectedTower) { content = <InventoryPanel />; key = 'inventory'; }
  else if (module === 'location' && selectedPoi) { content = <PoiCard />; key = 'poi'; }
  else if (module === 'plans' && selectedFlat) { content = <FlatSpecs />; key = 'specs'; }

  const visible = open && !!content;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key={key}
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="no-print glass absolute bottom-24 right-3 top-16 z-30 flex w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl sm:right-4 sm:top-20"
        >
          <button onClick={() => setOpen(false)} aria-label="Close panel" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          {content}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
