'use client';

import { clientApiFetch } from '@/lib/api/client';

export interface TenantBranchOption {
  id: string;
  name: string;
  code: string;
}

export interface TenantStaffItem {
  membershipId: string;
  profileId: string;
  email: string;
  displayName: string;
  role: 'staff';
  isActive: boolean;
  branchIds: string[];
  branches: TenantBranchOption[];
  createdAt: string;
  updatedAt: string;
}

interface TenantStaffListResponse {
  staff: TenantStaffItem[];
}

interface TenantStaffItemResponse {
  staff: TenantStaffItem;
}

interface TenantActionResponse {
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

export async function getTenantStaff(tenantSlug: string): Promise<TenantStaffListResponse> {
  const params = new URLSearchParams({ tenantSlug });

  return requestJson<TenantStaffListResponse>(
    `/api/tenant/staff?${params.toString()}`,
    { method: 'GET' },
    'Gagal memuat data staff.',
  );
}

export async function createTenantStaff(payload: {
  tenantSlug: string;
  email: string;
  displayName: string;
  temporaryPassword: string;
  branchIds: string[];
}): Promise<TenantStaffItemResponse> {
  return requestJson<TenantStaffItemResponse>(
    '/api/tenant/staff',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menambah staff.',
  );
}

export async function updateTenantStaff(
  membershipId: string,
  payload: {
    tenantSlug: string;
    displayName: string;
    branchIds: string[];
  },
): Promise<TenantStaffItemResponse> {
  return requestJson<TenantStaffItemResponse>(
    `/api/tenant/staff/${encodeURIComponent(membershipId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui staff.',
  );
}

export async function resetTenantStaffPassword(
  membershipId: string,
  payload: {
    tenantSlug: string;
    temporaryPassword: string;
  },
): Promise<TenantActionResponse> {
  return requestJson<TenantActionResponse>(
    `/api/tenant/staff/${encodeURIComponent(membershipId)}/password-reset`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal mereset password staff.',
  );
}

export async function deactivateTenantStaff(
  membershipId: string,
  payload: {
    tenantSlug: string;
  },
): Promise<TenantActionResponse> {
  const params = new URLSearchParams({
    tenantSlug: payload.tenantSlug,
  });

  return requestJson<TenantActionResponse>(
    `/api/tenant/staff/${encodeURIComponent(membershipId)}?${params.toString()}`,
    {
      method: 'DELETE',
    },
    'Gagal menonaktifkan staff.',
  );
}
