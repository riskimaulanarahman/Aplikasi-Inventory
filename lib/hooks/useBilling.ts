import { useState } from 'react';
import { clientApiJson } from '@/lib/api/client';

export interface InvoiceData {
  id: string;
  tenant_id: string;
  subscription_id: string;
  plan_id: string;
  invoice_number: string;
  payment_code: string;
  cycle: 'monthly' | 'yearly';
  amount: number;
  due_at: string;
  status: 'pending' | 'paid' | 'rejected' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface SubmissionData {
  id: string;
  tenant_id: string;
  invoice_id: string;
  proof_path: string;
  transfer_amount: number;
  bank_name: string;
  sender_bank?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface PlanData {
  id: string;
  code: string;
  name: string;
  description?: string;
  monthly_price: number;
  yearly_price: number;
}

export function useBilling(tenantSlug: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvoice = async (cycle: 'monthly' | 'yearly', planId?: string): Promise<InvoiceData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ invoice: InvoiceData }>('/api/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          tenantSlug,
          cycle,
          planId,
        }),
      });

      if (!result.response.ok) {
        throw new Error((result.payload as any)?.error || 'Gagal membuat invoice.');
      }

      setIsLoading(false);
      return result.payload.invoice;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat invoice.';
      setError(message);
      setIsLoading(false);
      return null;
    }
  };

  const getUploadUrl = async (ext: string = 'jpg'): Promise<{ path: string; uploadToken: string; uploadUrl: string } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ path: string; uploadToken: string; uploadUrl: string }>('/api/billing/payments/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          tenantSlug,
          ext,
        }),
      });

      if (!result.response.ok) {
        throw new Error((result.payload as any)?.error || 'Gagal mendapatkan URL unggah.');
      }

      setIsLoading(false);
      return result.payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mendapatkan URL unggah.';
      setError(message);
      setIsLoading(false);
      return null;
    }
  };

  const uploadProof = async (uploadToken: string, file: File): Promise<{ path: string; url: string } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('uploadToken', uploadToken);
      formData.append('file', file);

      const response = await fetch('/api/billing/payments/upload', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, it will be set automatically with boundary
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Gagal mengunggah bukti.');
      }

      setIsLoading(false);
      return payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengunggah bukti.';
      setError(message);
      setIsLoading(false);
      return null;
    }
  };

  const submitPayment = async (payload: {
    invoiceId: string;
    proofPath: string;
    transferAmount: number;
    bankName: string;
    senderBank?: string;
    note?: string;
  }): Promise<SubmissionData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ submission: SubmissionData }>('/api/billing/payments/submit', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          tenantSlug,
        }),
      });

      if (!result.response.ok) {
        throw new Error((result.payload as any)?.error || 'Gagal mengirim konfirmasi pembayaran.');
      }

      setIsLoading(false);
      return result.payload.submission;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim konfirmasi pembayaran.';
      setError(message);
      setIsLoading(false);
      return null;
    }
  };

  const getPublicPlans = async (): Promise<PlanData[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await clientApiJson<{ plans: PlanData[] }>('/api/public/plans');

      if (!result.response.ok) {
        throw new Error((result.payload as any)?.error || 'Gagal mengambil data paket.');
      }

      setIsLoading(false);
      return result.payload.plans || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengambil data paket.';
      setError(message);
      setIsLoading(false);
      return [];
    }
  };

  return {
    createInvoice,
    getUploadUrl,
    uploadProof,
    submitPayment,
    getPublicPlans,
    isLoading,
    error,
  };
}
