import type { FinishTier, RoomId } from './types';

export const TIER_RATE: Record<FinishTier, number> = {
  essential: 410,
  signature: 508,
  luxury: 710,
};

export const TIER_LABEL: Record<FinishTier, string> = {
  essential: 'Essential · Laminate',
  signature: 'Signature · Acrylic',
  luxury: 'Luxury · PU finish',
};

const ROOM_SHARE: Record<RoomId, number> = {
  living: 0.23,
  dining: 0.11,
  bedroom: 0.28,
  kitchen: 0.3,
  balcony: 0.08,
};

export function calculateInteriorQuote(sqft: number, tier: FinishTier) {
  const base = Math.round(sqft * TIER_RATE[tier]);
  const breakdown = {
    base,
    hardware: Math.round(base * 0.08),
    factoryDelivery: Math.round(base * 0.09),
    doorFinishing: Math.round(base * 0.1),
    installation: Math.round(base * 0.0984),
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const rooms = Object.fromEntries(
    Object.entries(ROOM_SHARE).map(([room, share]) => [room, Math.round(total * share)]),
  ) as Record<RoomId, number>;
  return { base, total, breakdown, rooms };
}
