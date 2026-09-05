'use client';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import LeftDrawer from './LeftDrawer';
import RightPanel from './RightPanel';
import LeadForm from './LeadForm';
import Shimmer from './Shimmer';
import { useRealtimeFlats } from './useRealtimeFlats';

const MasterPlanCanvas = dynamic(() => import('@/components/modules/MasterPlanCanvas'), { ssr: false, loading: () => <Shimmer label="Loading 3D master plan" /> });
const LocationMap = dynamic(() => import('@/components/modules/LocationMap'), { ssr: false, loading: () => <Shimmer label="Loading location intelligence" /> });
const AmenityViewer = dynamic(() => import('@/components/modules/AmenityViewer'), { ssr: false, loading: () => <Shimmer label="Loading amenities" /> });
const FloorPlanViewer = dynamic(() => import('@/components/modules/FloorPlanViewer'), { ssr: false, loading: () => <Shimmer label="Loading floor plan" /> });
const VirtualTour = dynamic(() => import('@/components/modules/VirtualTour'), { ssr: false, loading: () => <Shimmer label="Entering the home" /> });
const CostEngine = dynamic(() => import('@/components/modules/CostEngine'), { ssr: false, loading: () => <Shimmer label="Calculating your interior plan" /> });

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.35, ease: 'easeOut' } };

export default function Shell() {
  const module = useAppStore((s) => s.module);
  const realtime = useRealtimeFlats();
  const is3D = module === 'master' || module === 'towers';

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink">
      {/* Viewport */}
      <div className="absolute inset-0">
        {/* Keep one WebGL renderer active: preserve the canvas across MASTER/TOWERS,
            but release it before plans, cost, maps, amenities, or panoramas mount. */}
        {is3D && (
          <div className="absolute inset-0">
            <MasterPlanCanvas />
          </div>
        )}
        <AnimatePresence initial={false}>
          {module === 'location' && (
            <motion.div key="location" className="absolute inset-0" {...fade}><LocationMap /></motion.div>
          )}
          {module === 'amenities' && (
            <motion.div key="amenities" className="absolute inset-0" {...fade}><AmenityViewer /></motion.div>
          )}
          {module === 'plans' && (
            <motion.div key="plans" className="absolute inset-0" {...fade}><FloorPlanViewer /></motion.div>
          )}
          {module === 'tour' && (
            <motion.div key="tour" className="absolute inset-0 z-30" {...fade}><VirtualTour /></motion.div>
          )}
          {module === 'cost' && (
            <motion.div key="cost" className="absolute inset-0" {...fade}><CostEngine /></motion.div>
          )}
        </AnimatePresence>
      </div>

      {module !== 'tour' && (
        <>
          <TopBar realtime={realtime} />
          <LeftDrawer />
          <RightPanel />
          <BottomNav />
        </>
      )}
      <LeadForm />
    </div>
  );
}
