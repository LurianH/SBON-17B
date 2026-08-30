import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/site-url';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeInternalPath(url.searchParams.get('next'), '/account/update-password');
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const db = await createClient();

  let error = !db;
  if (db && code) {
    const result = await db.auth.exchangeCodeForSession(code);
    error = Boolean(result.error);
  } else if (db && tokenHash && type) {
    const result = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    error = Boolean(result.error);
  } else {
    error = true;
  }

  const destination = request.nextUrl.clone();
  destination.pathname = error ? '/login' : next;
  destination.search = error ? '?reason=recovery' : '';
  return NextResponse.redirect(destination);
}
