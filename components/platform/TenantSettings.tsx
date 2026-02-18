'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiJson } from '@/lib/api/client';

interface TenantSettingsProps {
  tenantId: string;
  initialTenantStatus: 'active' | 'suspended';
  initialSubscription: {
    status: string;
    trial_end_at: string | null;
    period_end_at: string | null;
    read_only_mode: boolean;
  } | null;
}

export default function TenantSettings({
  tenantId,
  initialTenantStatus,
  initialSubscription,
}: TenantSettingsProps) {
  const router = useRouter();

  // Tenant Status State
  const [tenantStatus, setTenantStatus] = useState<'active' | 'suspended'>(initialTenantStatus);
  const [isUpdatingTenant, setIsUpdatingTenant] = useState(false);

  // Subscription State
  const [subStatus, setSubStatus] = useState(initialSubscription?.status || 'trialing');
  const [trialEnd, setTrialEnd] = useState(initialSubscription?.trial_end_at ? new Date(initialSubscription.trial_end_at).toISOString().substring(0, 16) : '');
  const [periodEnd, setPeriodEnd] = useState(initialSubscription?.period_end_at ? new Date(initialSubscription.period_end_at).toISOString().substring(0, 16) : '');
  const [readOnly, setReadOnly] = useState(initialSubscription?.read_only_mode || false);
  const [isUpdatingSub, setIsUpdatingSub] = useState(false);

  const handleUpdateTenantStatus = async () => {
    if (!confirm('Are you sure you want to change the tenant status?')) return;

    setIsUpdatingTenant(true);
    try {
      const result = await clientApiJson<{ success: boolean; status: 'active' | 'suspended' }>(
        `/api/platform/tenants/${tenantId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: tenantStatus }),
        }
      );

      if (result.response.ok) {
        alert('Tenant status updated successfully');
        router.refresh();
      } else {
        throw new Error('Failed to update');
      }
    } catch (e) {
      alert('Error updating tenant status');
    } finally {
      setIsUpdatingTenant(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!confirm('Are you sure you want to manually override subscription?')) return;

    setIsUpdatingSub(true);
    try {
      const result = await clientApiJson<{ success: boolean }>(
        `/api/platform/tenants/${tenantId}/subscription`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: subStatus,
            trialEndAt: trialEnd || null,
            periodEndAt: periodEnd || null,
            readOnlyMode: readOnly,
          }),
        }
      );

      if (result.response.ok) {
        alert('Subscription updated successfully');
        router.refresh();
      } else {
        throw new Error('Failed to update');
      }
    } catch (e) {
      alert('Error updating subscription');
    } finally {
      setIsUpdatingSub(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      {/* Tenant Status Management */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Manage Tenant Status</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={tenantStatus}
              onChange={(e) => setTenantStatus(e.target.value as 'active' | 'suspended')}
              className="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="pt-2">
            <button
              onClick={handleUpdateTenantStatus}
              disabled={isUpdatingTenant}
              className="w-full inline-flex justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isUpdatingTenant ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </section>

      {/* Manual Billing Override */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-amber-500">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Manual Billing Override
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subscription Status</label>
            <select
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
              className="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Trial Ends</label>
              <input
                type="datetime-local"
                value={trialEnd}
                onChange={(e) => setTrialEnd(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Period Ends</label>
              <input
                type="datetime-local"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="readOnlyMode"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="readOnlyMode" className="text-sm text-slate-700 font-medium">
              Read Only Mode
            </label>
          </div>

          <div className="pt-2">
            <button
              onClick={handleUpdateSubscription}
              disabled={isUpdatingSub}
              className="w-full inline-flex justify-center rounded-lg border border-transparent bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isUpdatingSub ? 'Updating...' : 'Save Manual Override'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
