import Link from 'next/link';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/auth/LogoutButton';
import { getCurrentUserSession } from '@/lib/auth/session';
import { getUserTenants } from '@/lib/tenant/context';

function getRoleLabel(role: string): string {
  if (role === 'tenant_owner') return 'Owner Outlet/Cabang';
  if (role === 'tenant_admin') return 'Admin Outlet/Cabang';
  return 'Staf';
}

export default async function TenantLandingPage() {
  const session = await getCurrentUserSession();

  if (!session) {
    redirect('/login');
  }

  if (session.isPlatformAdmin) {
    redirect('/platform');
  }

  const memberships = await getUserTenants();

  if (memberships.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">Belum tergabung Outlet/Cabang</h1>
          <p className="mt-2 text-sm text-slate-600">Hubungi owner/admin Outlet/Cabang untuk menambahkan akun Anda.</p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>
      </main>
    );
  }

  if (memberships.length === 1) {
    redirect(`/t/${memberships[0].tenantSlug}`);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pilih Outlet/Cabang</h1>
          <p className="text-sm text-slate-600">Akun owner Anda terhubung ke beberapa Outlet/Cabang.</p>
        </div>
        <LogoutButton />
      </div>

      <div className="space-y-3">
        {memberships.map((membership) => (
          <Link
            key={`${membership.tenantId}-${membership.role}`}
            href={`/t/${membership.tenantSlug}`}
            className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300"
          >
            <p className="text-base font-semibold text-slate-900">{membership.tenantName}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">Role: {getRoleLabel(membership.role)}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
