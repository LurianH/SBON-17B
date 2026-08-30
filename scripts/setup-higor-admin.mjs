import { createClient } from '@supabase/supabase-js';

const higorEmail = process.env.SBON_TEST_HIGOR_EMAIL ?? process.env.SBON_TEST_NO_PROFILE_EMAIL;
const higorPassword = process.env.SBON_TEST_HIGOR_PASSWORD ?? process.env.SBON_TEST_NO_PROFILE_PASSWORD;
const required = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SBON_TEST_ADMIN_EMAIL: process.env.SBON_TEST_ADMIN_EMAIL,
  SBON_TEST_ADMIN_PASSWORD: process.env.SBON_TEST_ADMIN_PASSWORD,
  SBON_TEST_HIGOR_EMAIL: higorEmail,
  SBON_TEST_HIGOR_PASSWORD: higorPassword,
};
const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(required.NEXT_PUBLIC_SUPABASE_URL, required.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const higor = createClient(required.NEXT_PUBLIC_SUPABASE_URL, required.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);

const [{ data: adminAuth, error: adminError }, { data: higorAuth, error: higorError }] = await Promise.all([
  admin.auth.signInWithPassword({ email: required.SBON_TEST_ADMIN_EMAIL, password: required.SBON_TEST_ADMIN_PASSWORD }),
  higor.auth.signInWithPassword({ email: higorEmail, password: higorPassword }),
]);
if (adminError) throw new Error(`Autenticação do ADMIN principal falhou: ${adminError.message}`);
if (higorError) throw new Error(`Autenticação do usuário Higor existente falhou: ${higorError.message}`);
if (higorAuth.user.email?.toLowerCase() !== 'higorcardoso.eng@gmail.com') {
  throw new Error('A conta autenticada para Higor não corresponde ao e-mail definitivo.');
}
if (higorAuth.user.id !== 'be2dd14d-e4e7-4fc5-8be5-666e0eb49148') {
  throw new Error('O UUID autenticado de Higor diverge do UUID validado na Fase 3.');
}

const { data: existing, error: existingError } = await admin
  .from('profiles')
  .select('id,email,role,active')
  .eq('id', higorAuth.user.id)
  .maybeSingle();
if (existingError) throw existingError;

if (!existing) {
  const { error } = await admin.from('profiles').insert({
    id: higorAuth.user.id,
    email: 'higorcardoso.eng@gmail.com',
    full_name: 'Higor Cardoso',
    role: 'ADMIN',
    active: true,
  });
  if (error) throw error;
} else if (existing.email !== 'higorcardoso.eng@gmail.com' || existing.role !== 'ADMIN' || existing.active !== true) {
  const { error } = await admin
    .from('profiles')
    .update({ email: 'higorcardoso.eng@gmail.com', full_name: 'Higor Cardoso', role: 'ADMIN', active: true })
    .eq('id', higorAuth.user.id);
  if (error) throw error;
}

const { data: verified, error: verifyError } = await higor
  .from('profiles')
  .select('id,email,full_name,role,active')
  .eq('id', higorAuth.user.id)
  .single();
if (verifyError) throw verifyError;
if (verified.role !== 'ADMIN' || !verified.active) throw new Error('O profile final de Higor não ficou ADMIN ativo.');

console.log(JSON.stringify({
  authUserPreserved: true,
  createdNewAuthUser: false,
  profileAction: existing ? 'validated-or-updated' : 'inserted',
  profile: verified,
  adminPrincipalAuthenticated: Boolean(adminAuth.user),
}, null, 2));
