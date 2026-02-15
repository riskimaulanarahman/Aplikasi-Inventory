import { serverApiJson } from '@/lib/api/server';

export type MembershipRole = 'tenant_owner' | 'tenant_admin' | 'staff';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | null;

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  membershipId: string;
  membershipRole: MembershipRole;
  accessibleBranchIds: string[];
  isReadOnly: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndAt?: string | null;
}

export interface UserTenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: MembershipRole;
}

interface TenantContextResponse {
  profile: {
    id: string;
    email: string;
    displayName: string | null;
  };
  memberships: UserTenantMembership[];
}

interface TenantAccessResponse {
  context: TenantContext;
}

export async function getTenantContextBySlug(params: {
  tenantSlug: string;
}): Promise<TenantContext | null> {
  const { response, payload } = await serverApiJson<TenantAccessResponse | { error?: string }>(
    `/api/tenant/context?tenantSlug=${encodeURIComponent(params.tenantSlug)}`,
  );

  if (!response.ok || !payload || typeof payload !== 'object' || !('context' in payload)) {
    return null;
  }

  return payload.context;
}

export async function getUserTenants(): Promise<UserTenantMembership[]> {
  const { response, payload } = await serverApiJson<TenantContextResponse | { error?: string }>('/api/tenant/context');

  if (!response.ok || !payload || typeof payload !== 'object' || !('memberships' in payload)) {
    return [];
  }

  return payload.memberships;
}
