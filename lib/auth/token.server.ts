import { cookies } from 'next/headers';

export function getAuthTokenCookieName() {
  return process.env.AUTH_TOKEN_COOKIE ?? process.env.NEXT_PUBLIC_AUTH_TOKEN_COOKIE ?? 'tw_access_token';
}

export function getServerAuthToken() {
  const store = cookies();
  return store.get(getAuthTokenCookieName())?.value ?? null;
}
