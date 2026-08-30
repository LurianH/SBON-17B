'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    const db = createClient();
    if (db) await db.auth.signOut();
    location.replace('/login');
  }

  return <button className="logout-link" disabled={busy} onClick={logout}>{busy ? 'Saindo…' : 'Sair'}</button>;
}
