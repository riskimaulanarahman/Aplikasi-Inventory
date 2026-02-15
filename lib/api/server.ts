import { getServerApiBaseUrl } from '@/lib/api/base';
import { getServerAuthToken } from '@/lib/auth/token.server';

export async function serverApiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getServerAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return fetch(`${getServerApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export async function serverApiJson<T>(path: string, init: RequestInit = {}) {
  const response = await serverApiFetch(path, init);
  const payload = await response.json().catch(() => null);

  return {
    response,
    payload: payload as T,
  };
}
