'use client';
import { create } from 'zustand';
import type { ModuleId, FlatStatus, PoiCategory, RoomId, ConstructionPhase, FinishTier } from '@/lib/types';
import { project } from '@/lib/data';
import { analytics } from '@/lib/analytics';

interface AppState {
  module: ModuleId;
  setModule: (m: ModuleId) => void;

  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;

  selectedTower: string | null;
  selectedFloor: number | null;
  selectedFlatId: string | null;
  hoveredTower: string | null;
  selectTower: (id: string | null) => void;
  selectFloor: (floor: number | null) => void;
  selectFlat: (id: string | null) => void;
  setHoveredTower: (id: string | null) => void;
  constructionPhase: ConstructionPhase;
  setConstructionPhase: (phase: ConstructionPhase) => void;

  // Inventory filters
  search: string;
  bhkFilter: number | null;
  sqftFilter: number | null;
  statusFilter: FlatStatus | null;
  setSearch: (s: string) => void;
  setBhkFilter: (b: number | null) => void;
  setSqftFilter: (s: number | null) => void;
  setStatusFilter: (s: FlatStatus | null) => void;

  // Live statuses (Supabase realtime overrides mock data)
  statuses: Record<string, FlatStatus>;
  setStatus: (id: string, status: FlatStatus) => void;
  setStatuses: (map: Record<string, FlatStatus>) => void;

  // Location
  categories: Record<PoiCategory, boolean>;
  toggleCategory: (c: PoiCategory) => void;
  distanceFilter: number | null;
  setDistanceFilter: (km: number | null) => void;
  selectedPoiId: string | null;
  selectPoi: (id: string | null) => void;

  // Amenities
  activeAmenity: string | null;
  setActiveAmenity: (id: string | null) => void;

  // Tour
  room: RoomId;
  setRoom: (r: RoomId) => void;
  /** exact unit-plan space being toured, e.g. 'master' | 'bed2' | 'kitchen' */
  spaceKey: string | null;
  setSpace: (key: string, room: RoomId) => void;
  finishTier: FinishTier;
  setFinishTier: (tier: FinishTier) => void;
  leadOpen: boolean;
  setLeadOpen: (v: boolean) => void;
}

const initialStatuses = Object.fromEntries(project.flats.map((f) => [f.id, f.status])) as Record<string, FlatStatus>;

export const useAppStore = create<AppState>((set, get) => ({
  module: 'master',
  setModule: (m) => {
    analytics.enterModule(m);
    set({
      module: m,
      leftOpen: m === 'location' || m === 'towers',
      rightOpen: m === 'towers' ? true : m === 'plans' ? !!get().selectedFlatId : false,
    });
  },

  leftOpen: false,
  rightOpen: false,
  setLeftOpen: (v) => set({ leftOpen: v }),
  setRightOpen: (v) => set({ rightOpen: v }),

  selectedTower: null,
  selectedFloor: null,
  selectedFlatId: null,
  hoveredTower: null,
  selectTower: (id) => {
    if (id) analytics.track('tower_selected', { tower: id });
    set({ selectedTower: id, selectedFloor: null, selectedFlatId: null, rightOpen: !!id });
  },
  selectFloor: (floor) => {
    if (floor !== null) analytics.track('floor_selected', { tower: get().selectedTower, floor });
    set({ selectedFloor: floor, selectedFlatId: null });
  },
  selectFlat: (id) => {
    if (id) {
      const flat = project.flats.find((f) => f.id === id);
      analytics.track('flat_selected', { flat: id });
      set({ selectedFlatId: id, selectedTower: flat?.tower ?? get().selectedTower, selectedFloor: flat?.floor ?? get().selectedFloor });
    } else set({ selectedFlatId: null });
  },
  setHoveredTower: (id) => set({ hoveredTower: id }),
  constructionPhase: 'complete',
  setConstructionPhase: (constructionPhase) => {
    analytics.track('construction_phase_changed', { phase: constructionPhase });
    set({ constructionPhase });
  },

  search: '',
  bhkFilter: null,
  sqftFilter: null,
  statusFilter: null,
  setSearch: (search) => set({ search }),
  setBhkFilter: (bhkFilter) => set({ bhkFilter }),
  setSqftFilter: (sqftFilter) => set({ sqftFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  statuses: initialStatuses,
  setStatus: (id, status) => set((s) => ({ statuses: { ...s.statuses, [id]: status } })),
  setStatuses: (map) => set((s) => ({ statuses: { ...s.statuses, ...map } })),

  categories: { Schools: true, Hospitals: true, Transport: true, Malls: false, Roads: false },
  toggleCategory: (c) => set((s) => ({ categories: { ...s.categories, [c]: !s.categories[c] } })),
  distanceFilter: null,
  setDistanceFilter: (distanceFilter) => set({ distanceFilter }),
  selectedPoiId: null,
  selectPoi: (id) => {
    if (id) analytics.track('poi_selected', { poi: id });
    set({ selectedPoiId: id, rightOpen: !!id });
  },

  activeAmenity: null,
  setActiveAmenity: (id) => {
    if (id) analytics.track('amenity_opened', { amenity: id });
    set({ activeAmenity: id });
  },

  room: 'living',
  setRoom: (room) => {
    analytics.track('room_changed', { room });
    set({ room, spaceKey: null });
  },
  spaceKey: null,
  setSpace: (spaceKey, room) => {
    analytics.track('room_changed', { room, space: spaceKey });
    set({ spaceKey, room });
  },
  finishTier: 'signature',
  setFinishTier: (finishTier) => {
    analytics.track('finish_tier_changed', { tier: finishTier });
    set({ finishTier });
  },
  leadOpen: false,
  setLeadOpen: (leadOpen) => set({ leadOpen }),
}));

// Dev/QA hook: drive the app from the console, e.g. __navigo.getState().selectFlat('P2-1202')
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') (window as unknown as { __navigo?: typeof useAppStore }).__navigo = useAppStore;
