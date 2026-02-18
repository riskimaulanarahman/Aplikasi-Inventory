import { redirect } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from '@/components/auth/LogoutButton';
import { getCurrentUserSession } from '@/lib/auth/session';
import { serverApiJson } from '@/lib/api/server';
import PlatformClient from '@/components/platform/PlatformClient';

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

export default async function PlatformPage() {
  const session = await getCurrentUserSession();

  if (!session) {
    redirect('/login');
  }

  const [plansResult, tenantsResult, paymentsResult] = await Promise.all([
    serverApiJson<{ plans: PlanItem[] } | { error?: string }>('/api/platform/plans'),
    serverApiJson<{ tenants: TenantItem[] } | { error?: string }>('/api/platform/tenants'),
    serverApiJson<{ submissions: SubmissionItem[] } | { error?: string }>('/api/platform/payments'),
  ]);

  if (plansResult.response.status === 403 || tenantsResult.response.status === 403 || paymentsResult.response.status === 403) {
    redirect('/t');
  }

  const plans = plansResult.response.ok && plansResult.payload && 'plans' in plansResult.payload ? plansResult.payload.plans : [];
  const tenants = tenantsResult.response.ok && tenantsResult.payload && 'tenants' in tenantsResult.payload ? tenantsResult.payload.tenants : [];
  const pendingPayments = paymentsResult.response.ok && paymentsResult.payload && 'submissions' in paymentsResult.payload
    ? paymentsResult.payload.submissions.filter((item) => item.status === 'pending')
    : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Control</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">Monitoring SaaS</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/platform/users"
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              User Management
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <PlatformClient
        initialPlans={plans}
        initialTenants={tenants}
        initialPendingPayments={pendingPayments}
      />
    </div>
  );
}
