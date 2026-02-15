'use client';

function getCookie(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAuthTokenCookieName() {
  return process.env.NEXT_PUBLIC_AUTH_TOKEN_COOKIE ?? 'tw_access_token';
}

export function getClientAuthToken() {
  return getCookie(getAuthTokenCookieName());
}

export function setClientAuthToken(token: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${getAuthTokenCookieName()}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearClientAuthToken() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${getAuthTokenCookieName()}=; Path=/; Max-Age=0; SameSite=Lax`;
}
