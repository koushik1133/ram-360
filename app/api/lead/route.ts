import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface LeadPayload {
  name: string;
  phone: string;
  email: string;
  unit?: string;
  message?: string;
  engagement?: { totalSeconds: number; perModuleSeconds: Record<string, number> };
}

export async function POST(req: Request) {
  let body: LeadPayload;
  try {
    body = (await req.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const email = body.email?.trim();
  if (!name || !phone || !email || !/^\S+@\S+\.\S+$/.test(email) || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ ok: false, error: 'Please provide a valid name, phone and email.' }, { status: 422 });
  }

  const lead = { name, phone, email, unit: body.unit ?? null, message: body.message ?? null, engagement: body.engagement ?? null, source: 'navigo-web' };

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

  console.info('[lead] received', lead);
  return NextResponse.json({ ok: true });
}
