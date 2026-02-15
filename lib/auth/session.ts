import { serverApiJson } from '@/lib/api/server';

export interface CurrentUserSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  profile: {
    id: string;
    email: string;
    displayName: string | null;
    phone: string | null;
    mustResetPassword: boolean;
    isActive: boolean;
  };
  isPlatformAdmin: boolean;
}

export async function getCurrentUserSession(): Promise<CurrentUserSession | null> {
  const { response, payload } = await serverApiJson<CurrentUserSession | { error?: string }>('/api/auth/me');

  if (!response.ok) {
    return null;
  }

  if (!payload || typeof payload !== 'object' || !('user' in payload)) {
    return null;
  }

  return payload as CurrentUserSession;
}
