import raw from '@/data/project.json';
import type { ProjectData, Flat } from './types';

export const project = raw as unknown as ProjectData;

export const CATEGORIES = ['Schools', 'Hospitals', 'Transport', 'Malls', 'Roads'] as const;

export const CATEGORY_ICON: Record<string, string> = {
  Schools: '🎓',
  Hospitals: '🏥',
  Transport: '🚇',
  Malls: '🛍️',
  Roads: '🛣️',
};

export const flatsByTower = (towerId: string): Flat[] => project.flats.filter((f) => f.tower === towerId);

export const floorLabel = (floor: number) => (floor === 0 ? 'G' : String(floor));

export const assetUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  const cdn = process.env.NEXT_PUBLIC_ASSET_CDN;
  return cdn ? `${cdn.replace(/\/$/, '')}${path}` : path;
};

export const STATUS_COLOR: Record<string, string> = {
  available: '#3d8f62',
  sold: '#a34b42',
  reserved: '#c49a3a',
};
