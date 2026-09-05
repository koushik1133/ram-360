/**
 * Lightweight engagement tracker. Records time spent per module and key events.
 * Swap `emit` for Mixpanel / GA / Segment in production.
 */
type EventName = 'module_view' | 'tower_selected' | 'floor_selected' | 'flat_selected' | 'tour_entered' | 'room_changed' | 'lead_submitted' | 'poi_selected' | 'amenity_opened' | 'construction_phase_changed' | 'finish_tier_changed';

const sessionStart = typeof performance !== 'undefined' ? performance.now() : 0;
const moduleTime: Record<string, number> = {};
let currentModule: string | null = null;
let moduleEnteredAt = sessionStart;

function emit(name: EventName, props: Record<string, unknown> = {}) {
  const payload = { name, ts: Date.now(), sessionSeconds: Math.round((performance.now() - sessionStart) / 1000), ...props };
  if (process.env.NODE_ENV !== 'production') console.debug('[navigo:analytics]', payload);
  const w = window as unknown as { mixpanel?: { track: (n: string, p: unknown) => void } };
  w.mixpanel?.track(name, payload);
}

export const analytics = {
  track: emit,
  enterModule(id: string) {
    const now = performance.now();
    if (currentModule) moduleTime[currentModule] = (moduleTime[currentModule] ?? 0) + (now - moduleEnteredAt);
    currentModule = id;
    moduleEnteredAt = now;
    emit('module_view', { module: id });
  },
  summary() {
    const now = performance.now();
    const snapshot = { ...moduleTime };
    if (currentModule) snapshot[currentModule] = (snapshot[currentModule] ?? 0) + (now - moduleEnteredAt);
    return { totalSeconds: Math.round((now - sessionStart) / 1000), perModuleSeconds: Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, Math.round(v / 1000)])) };
  },
};
