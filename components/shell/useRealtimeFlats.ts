'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { FlatStatus } from '@/lib/types';

/**
 * Syncs flat statuses with the Supabase `flats` table.
 * - initial fetch of all statuses
 * - realtime UPDATE/INSERT stream -> store (dot turns red the instant an admin marks a unit sold)
 * Returns 'live' | 'demo' | 'connecting' for the top bar indicator.
 */
export function useRealtimeFlats() {
  const [state, setState] = useState<'live' | 'demo' | 'connecting'>('connecting');
  const setStatus = useAppStore((s) => s.setStatus);
  const setStatuses = useAppStore((s) => s.setStatuses);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setState('demo');
      return;
    }
    let cancelled = false;
    supabase
      .from('flats')
      .select('id,status')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[realtime] initial fetch failed', error.message);
          setState('demo');
          return;
        }
        if (data?.length) setStatuses(Object.fromEntries(data.map((r) => [r.id as string, r.status as FlatStatus])));
      });

    const channel = supabase
      .channel('flats-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flats' }, (payload) => {
        const row = payload.new as { id?: string; status?: FlatStatus };
        if (row?.id && row.status) setStatus(row.id, row.status);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setState('live');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setState('demo');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [setStatus, setStatuses]);

  return state;
}
