import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Returns a Supabase client when env vars exist, otherwise null (app falls back to mock data). */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('your-project')) return null;
  if (!client) client = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
  return client;
}
