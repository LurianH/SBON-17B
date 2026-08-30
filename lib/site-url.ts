export function getPublicSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

export function safeInternalPath(value: string | null, fallback = '/') {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
