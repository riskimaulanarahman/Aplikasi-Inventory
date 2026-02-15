'use client';

import { clientApiFetch } from '@/lib/api/client';

interface ApiProfileResponse {
  profile: {
    id: string;
    email: string;
    displayName: string | null;
    phone: string | null;
    mustResetPassword: boolean;
    isActive: boolean;
  };
  message?: string;
}

interface ApiMessageResponse {
  ok?: boolean;
  message?: string;
}

function normalizeApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message;
  }

  if ('error' in payload) {
    const error = payload.error;
    if (typeof error === 'string' && error.trim() !== '') {
      return error;
    }
    if (error && typeof error === 'object') {
      const firstEntry = Object.values(error as Record<string, unknown>)[0];
      if (Array.isArray(firstEntry) && typeof firstEntry[0] === 'string') {
        return firstEntry[0];
      }
      if (typeof firstEntry === 'string') {
        return firstEntry;
      }
    }
  }

  return fallback;
}

async function requestJson<T>(path: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await clientApiFetch(path, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(normalizeApiError(payload, fallbackError));
  }

  return payload as T;
}

export async function updateMyProfile(payload: {
  displayName: string;
  phone: string | null;
}): Promise<ApiProfileResponse> {
  return requestJson<ApiProfileResponse>(
    '/api/auth/profile',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui profil.',
  );
}

export async function changeMyPassword(payload: {
  newPassword: string;
  newPasswordConfirmation: string;
}): Promise<ApiMessageResponse> {
  return requestJson<ApiMessageResponse>(
    '/api/auth/password',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal mengubah password.',
  );
}
