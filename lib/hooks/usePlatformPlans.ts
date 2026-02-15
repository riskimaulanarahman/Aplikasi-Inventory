import { useState } from 'react';
import { clientApiJson } from '@/lib/api/client';

export interface PlanData {
  id: string;
  code: string;
  name: string;
  description?: string;
  monthly_price: string;
  yearly_price: string;
  is_active: boolean;
}

export interface CreatePlanPayload {
  code: string;
  name: string;
  description?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  isActive?: boolean;
}

export interface UpdatePlanPayload {
  id: string;
  name?: string;
  description?: string;
  monthlyPrice?: string;
  yearlyPrice?: string;
  isActive?: boolean;
}

export function usePlatformPlans() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPlan = async (payload: CreatePlanPayload): Promise<PlanData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ plan: PlanData }>('/api/platform/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!result.response.ok) {
        const errorData = result.payload as any;
        throw new Error(errorData?.message || 'Gagal membuat paket.');
      }

      setIsLoading(false);
      return result.payload.plan;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat paket.';
      setError(message);
      setIsLoading(false);
      return null;
    }
  };

  const updatePlan = async (payload: UpdatePlanPayload): Promise<PlanData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ plan: PlanData }>('/api/platform/plans', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (!result.response.ok) {
        const errorData = result.payload as any;
        throw new Error(errorData?.message || 'Gagal memperbarui paket.');
      }

      setIsLoading(false);
      return result.payload.plan;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui paket.';
      setError(message);
      setIsLoading(false);
      return null;
    }
  };

  const deletePlan = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ success: boolean }>('/api/platform/plans', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });

      if (!result.response.ok) {
        const errorData = result.payload as any;
        throw new Error(errorData?.message || 'Gagal menghapus paket.');
      }

      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus paket.';
      setError(message);
      setIsLoading(false);
      return false;
    }
  };

  return {
    createPlan,
    updatePlan,
    deletePlan,
    isLoading,
    error,
  };
}
