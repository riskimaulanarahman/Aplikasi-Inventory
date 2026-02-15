import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUserSession } from '@/lib/auth/session';
import { serverApiJson } from '@/lib/api/server';

interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    expiryDate: string | null;
  };
  owner: {
    email: string;
    display_name: string;
    phone: string | null;
  } | null;
  subscription: {
    status: string;
    current_cycle: string;
    period_start_at: string;
    period_end_at: string;
    trial_start_at: string | null;
    trial_end_at: string | null;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    quantity: number;
    notes: string | null;
    created_at: string;
    branch_name: string;
    product_name: string;
    user_name: string;
  }>;
}

export default async function TenantDetailPage({ params }: { params: { tenantId: string } }) {
  const session = await getCurrentUserSession();

  if (!session) {
    redirect('/login');
  }

  const { payload, response } = await serverApiJson<TenantDetail>(`/api/platform/tenants/${params.tenantId}`);

  if (response.status === 403) {
    redirect('/t');
  }

  if (!response.ok || !payload) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <Link href="/platform" className="text-sm text-indigo-600 hover:text-indigo-900 mb-4 inline-block">
          ← Back to Platform Dashboard
        </Link>
        <p className="text-red-600">
          {response.status === 404 ? 'Tenant not found.' : `Error loading tenant details (${response.status}).`}
        </p>
      </main>
    );
  }

  const { tenant, owner, subscription, branches, transactions } = payload;

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/platform"
              className="group inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{tenant.name}</h1>
              <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tenant.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${
                tenant.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {tenant.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tenant Info */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="h-12 w-12 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Outlet Info</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label>
                <p className="text-sm font-semibold text-slate-900">{owner?.email || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                <p className="text-sm font-semibold text-slate-900">{owner?.phone || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Owner</label>
                <p className="text-sm font-semibold text-slate-900">{owner?.display_name || '-'}</p>
              </div>
            </div>
          </section>

          {/* Subscription Info */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden border-r-4 border-r-indigo-500 group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="h-12 w-12 text-indigo-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-indigo-600">Subscription Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-50 rounded-xl p-4 border border-indigo-100/50">
                <div>
                  <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Current Plan Status</label>
                  <p className="text-lg font-black text-indigo-900 uppercase tracking-tighter">{subscription?.status || 'Active'}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  subscription?.status === 'active' || !subscription ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-600'
                }`}>
                  {subscription?.current_cycle || 'Monthly'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Member Since</label>
                  <p className="text-sm font-semibold text-slate-900">{new Date(tenant.createdAt).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {subscription?.status === 'trialing' ? 'Trial Ends' : 'Expiration'}
                  </label>
                  <p className={`text-sm font-black ${
                    subscription?.status === 'trialing' 
                      ? 'text-amber-600' 
                      : (new Date(subscription?.period_end_at || Date.now()) < new Date() ? 'text-red-600' : 'text-slate-900')
                  }`}>
                    {subscription?.status === 'trialing' 
                      ? (subscription.trial_end_at ? new Date(subscription.trial_end_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A')
                      : (subscription?.period_end_at ? new Date(subscription.period_end_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A')
                    }
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Branches Grid */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest px-1 flex items-center gap-2">
            <div className="h-1 w-8 bg-indigo-500 rounded-full"></div>
            Outlets & Branches ({branches.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch: any) => (
              <div key={branch.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-lg transition-all border-l-4 border-l-slate-300 hover:border-l-indigo-500">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-slate-900 tracking-tight">{branch.name}</h3>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">{branch.type}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">Branch ID: {branch.id.substring(0, 8)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Transactions Table */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden border-t-4 border-t-slate-800">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Recent Stock Activities
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Activity</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Product</th>
                  <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Branch</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                  <th className="hidden sm:table-cell px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${tx.type === 'in' ? 'bg-emerald-100 text-emerald-700' : tx.type === 'out' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {tx.type === 'in' ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                            </svg>
                          ) : tx.type === 'out' ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">{tx.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-900">{tx.product_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.id.substring(0, 8)}</div>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-medium">{tx.branch_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-black ${tx.quantity > 0 ? 'text-emerald-600' : tx.quantity < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-xs text-slate-400 font-medium">
                        {new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className="px-6 py-12 text-center text-slate-400">
                Belum ada aktivitas stok tercatat.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
