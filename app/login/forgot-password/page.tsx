'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPublicSiteUrl } from '@/lib/site-url';

export default function ForgotPassword() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestReset(formData: FormData) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const db = createClient();
    if (!db) {
      setMessage('Supabase não configurado.');
      setBusy(false);
      return;
    }

    const email = String(formData.get('email')).trim();
    const redirectTo = `${getPublicSiteUrl()}/auth/confirm?next=/account/update-password`;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    setMessage(error
      ? 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.'
      : 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
  }

  return <div className="login-page"><div className="login-card"><div className="brand"><span className="mark">V</span><span><b>vitalux</b><small>ECOATIVA</small></span></div><span className="eyebrow">SBON 17B</span><h1>Recuperar senha</h1><p>Informe o e-mail da sua conta existente.</p><form action={requestReset} className="data-form"><label>E-mail<input name="email" type="email" autoComplete="email" required/></label><button disabled={busy}>{busy ? 'Enviando…' : 'Enviar instruções'}</button><span className="form-message" aria-live="polite">{message}</span></form><Link className="login-link" href="/login">Voltar ao login</Link></div></div>;
}
