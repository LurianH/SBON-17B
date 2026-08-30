'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePassword() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function updatePassword(formData: FormData) {
    if (busy) return;
    const password = String(formData.get('password'));
    const confirmation = String(formData.get('confirmation'));
    if (password.length < 8) {
      setMessage('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setMessage('As senhas não coincidem.');
      return;
    }

    setBusy(true);
    const db = createClient();
    if (!db) {
      setMessage('Supabase não configurado.');
      setBusy(false);
      return;
    }
    const { error } = await db.auth.updateUser({ password });
    if (error) {
      setMessage('O link expirou ou a senha não pôde ser atualizada. Solicite uma nova recuperação.');
      setBusy(false);
      return;
    }
    await db.auth.signOut();
    location.replace('/login?reason=password-updated');
  }

  return <div className="login-page"><div className="login-card"><div className="brand"><span className="mark">V</span><span><b>vitalux</b><small>ECOATIVA</small></span></div><span className="eyebrow">SBON 17B</span><h1>Definir nova senha</h1><p>Escolha uma senha com pelo menos 8 caracteres.</p><form action={updatePassword} className="data-form"><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} required/></label><label>Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required/></label><button disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar senha'}</button><span className="form-message" aria-live="polite">{message}</span></form></div></div>;
}
