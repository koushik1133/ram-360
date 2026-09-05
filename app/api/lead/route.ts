import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(24).refine((value) => value.replace(/\D/g, '').length >= 8, 'Invalid phone'),
  email: z.string().trim().email().max(254),
  unit: z.string().trim().max(30).optional(),
  message: z.string().trim().max(1_000).optional(),
  engagement: z.object({
    totalSeconds: z.number().nonnegative().max(86_400),
    perModuleSeconds: z.record(z.string(), z.number().nonnegative().max(86_400)),
  }).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Please provide a valid name, phone and email.' }, { status: 422 });
  }

  const body = parsed.data;
  const lead = { name: body.name, phone: body.phone, email: body.email, unit: body.unit ?? null, message: body.message ?? null, engagement: body.engagement ?? null, source: 'orion-360' };

  // 1) Persist to Supabase if configured
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && !url.includes('your-project')) {
    try {
      const supabase = createClient(url, key);
      const { error } = await supabase.from('leads').insert(lead);
      if (error) console.error('[lead] supabase insert failed', error.message);
    } catch (e) {
      console.error('[lead] supabase error', e);
    }
  }

  // 2) Forward to CRM webhook if configured
  if (process.env.LEAD_WEBHOOK_URL) {
    try {
      await fetch(process.env.LEAD_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead) });
    } catch (e) {
      console.error('[lead] webhook failed', e);
    }
  }

  console.info('[lead] received', { unit: lead.unit, source: lead.source });
  return NextResponse.json({ ok: true });
}
