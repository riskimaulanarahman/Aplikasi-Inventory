'use client';

import { getClientApiBaseUrl } from '@/lib/api/base';
import { getClientAuthToken } from '@/lib/auth/token.client';

export async function clientApiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getClientAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return fetch(`${getClientApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}

export async function clientApiJson<T>(path: string, init: RequestInit = {}): Promise<{ response: Response; payload: T }> {
  const headers = new Headers(init.headers);
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await clientApiFetch(path, {
    ...init,
    headers,
  });

  let payload: T;
  try {
    payload = await response.json();
  } catch (error) {
    payload = {} as T;
  }

  return { response, payload };
}
