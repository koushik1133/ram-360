// Seeds the Supabase `flats` table from /data/project.json.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const data = JSON.parse(readFileSync(new URL('../data/project.json', import.meta.url), 'utf8'));
const rows = data.flats.map((f) => ({ id: f.id, tower: f.tower, floor: f.floor, flat_no: f.flatNo, bhk: f.bhk, sqft: f.sqft, facing: f.facing, status: f.status, price: f.price }));
const supabase = createClient(url, key);
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await supabase.from('flats').upsert(rows.slice(i, i + 200));
  if (error) { console.error(error); process.exit(1); }
}
console.log(`seeded ${rows.length} flats`);
