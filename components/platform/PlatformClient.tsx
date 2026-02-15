'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlanDialog, { PlanFormData } from './PlanDialog';
import { usePlatformPlans, PlanData } from '@/lib/hooks/usePlatformPlans';

interface PlanItem {
  id: string;
  code: string;
  name: string;
  monthly_price: string;
  yearly_price: string;
  is_active: boolean;
}

interface TenantItem {
  id: string;
  name: string;
  status: string;
  expiryDate: string | null;
  subscription: { status: string } | null;
  counts: { memberships: number; branches: number };
}

interface SubmissionItem {
  id: string;
  status: string;
  bankName: string;
  createdAt: string;
  invoice: { invoiceNumber: string; amount: string };
  tenant: { name: string; slug: string };
}

interface PlatformClientProps {
  initialPlans: PlanItem[];
  initialTenants: TenantItem[];
  initialPendingPayments: SubmissionItem[];
}

export default function PlatformClient({
  initialPlans,
  initialTenants,
  initialPendingPayments,
}: PlatformClientProps) {
  const router = useRouter();
  const { createPlan, updatePlan, deletePlan, isLoading, error } = usePlatformPlans();
  
  const [plans, setPlans] = useState<PlanItem[]>(initialPlans);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const handleEditPlan = (plan: PlanItem) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    const success = await deletePlan(id);
    if (success) {
      setPlans((prev) => prev.filter((p) => p.id !== id));
      setSuccessMessage('Plan deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async (formData: PlanFormData) => {
    let result: PlanData | null = null;

    if (editingPlan) {
      result = await updatePlan({
        id: editingPlan.id,
        name: formData.name,
        description: formData.description,
        monthlyPrice: formData.monthlyPrice,
        yearlyPrice: formData.yearlyPrice,
        isActive: formData.isActive,
      });
    } else {
      result = await createPlan({
        code: formData.code!,
        name: formData.name,
        description: formData.description,
        monthlyPrice: formData.monthlyPrice,
        yearlyPrice: formData.yearlyPrice,
        isActive: formData.isActive,
      });
    }

    if (result) {
      if (editingPlan) {
        setPlans((prev) =>
          prev.map((p) => (p.id === result!.id ? result! : p))
        );
        setSuccessMessage('Plan updated successfully!');
      } else {
        setPlans((prev) => [...prev, result!]);
        setSuccessMessage('Plan created successfully!');
      }
      
      handleCloseDialog();
      setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Messages */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl border border-white/10">
            {successMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800 flex items-center gap-3">
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Payment Queue Section */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden border-t-4 border-t-indigo-500">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Payment Queue
          </h2>
        </div>
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Outlet/Cabang</th>
                <th className="hidden px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest sm:table-cell">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="hidden px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest md:table-cell">Bank</th>
                <th className="hidden px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest lg:table-cell text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {initialPendingPayments.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-900">{item.tenant.name}</div>
                    <div className="sm:hidden text-xs text-slate-500 mt-0.5">{item.invoice.invoiceNumber}</div>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap sm:table-cell">
                    <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{item.invoice.invoiceNumber}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-900">{item.invoice.amount}</div>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap md:table-cell">
                    <div className="text-sm text-slate-700">{item.bankName}</div>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap lg:table-cell text-right">
                    <div className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {initialPendingPayments.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Antrian pembayaran kosong.</p>
            </div>
          )}
        </div>
      </section>

      {/* Monitor Outlet/Cabang Section */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden border-t-4 border-t-blue-500">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Monitor Outlet/Cabang
          </h2>
        </div>
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Outlet/Cabang</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="hidden px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest sm:table-cell">Expired</th>
                <th className="hidden px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest md:table-cell text-center">Users</th>
                <th className="hidden px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest lg:table-cell text-center">Branches</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {initialTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-900">{tenant.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        tenant.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap sm:table-cell">
                    <div className="text-sm text-slate-600">
                      {tenant.expiryDate
                        ? new Date(tenant.expiryDate).toLocaleDateString('id-ID')
                        : '-'}
                    </div>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap md:table-cell text-center">
                    <span className="text-sm font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{tenant.counts.memberships}</span>
                  </td>
                  <td className="hidden px-6 py-4 whitespace-nowrap lg:table-cell text-center">
                    <span className="text-sm font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{tenant.counts.branches}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/platform/tenants/${tenant.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-all"
                    >
                      Detail
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden border-t-4 border-t-purple-500">
        <div className="bg-slate-50 border-b border-slate-200 flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pricing Plans
          </h2>
          <button
            onClick={handleCreatePlan}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Plan
          </button>
        </div>
        <div className="px-6 pb-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-xl hover:border-indigo-100 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-1">{plan.code}</span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{plan.name}</h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                      plan.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}
                  >
                    {plan.is_active ? 'active' : 'inactive'}
                  </span>
                </div>
                
                <div className="space-y-3 flex-1 border-t border-slate-50 pt-4 mt-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400 font-medium">Monthly</span>
                    <span className="text-sm font-bold text-slate-900">Rp {parseInt(plan.monthly_price).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400 font-medium">Yearly</span>
                    <span className="text-sm font-bold text-slate-900">Rp {parseInt(plan.yearly_price).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 h-10">
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Plan"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEditPlan(plan)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-100"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Edit
                  </button>
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-medium">No pricing plans available.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Plan Dialog */}
      <PlanDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        plan={editingPlan}
        isLoading={isLoading}
      />
    </div>
  );
}
