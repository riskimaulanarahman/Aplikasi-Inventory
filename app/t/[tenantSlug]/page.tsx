import { notFound, redirect } from 'next/navigation';
import InventoryApp from '@/components/inventory/InventoryApp';
import { getCurrentUserSession } from '@/lib/auth/session';
import { getTenantContextBySlug } from '@/lib/tenant/context';
import type { MasterTab, MoreTab, ReportTab, TabKey } from '@/components/inventory/types';

type SearchParams = Record<string, string | string[] | undefined>;

function takeFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function isValidTab(value: string | null): value is TabKey {
  return value === 'dashboard' || value === 'in' || value === 'out' || value === 'more';
}

function isValidMoreTab(value: string | null): value is MoreTab {
  return value === 'history' || value === 'master' || value === 'transfer' || value === 'opname' || value === 'report';
}

function isValidMasterTab(value: string | null): value is MasterTab {
  return value === 'products' || value === 'categories' || value === 'units' || value === 'outlets' || value === 'staff';
}

function isValidReportTab(value: string | null): value is ReportTab {
  return value === 'analytics' || value === 'export' || value === 'item-report';
}

function getRoleLabel(role: string): string {
  if (role === 'tenant_owner') return 'Owner Outlet/Cabang';
  if (role === 'tenant_admin') return 'Admin Outlet/Cabang';
  return 'Staf';
}

export default async function TenantDashboardPage({
  params,
  searchParams,
}: {
  params: { tenantSlug: string };
  searchParams?: SearchParams;
}) {
  const session = await getCurrentUserSession();

  if (!session) {
    redirect('/login');
  }

  const context = await getTenantContextBySlug({
    tenantSlug: params.tenantSlug,
  });

  if (!context) {
    notFound();
  }

  const tabParam = takeFirst(searchParams?.tab);
  const moreTabParam = takeFirst(searchParams?.moreTab);
  const masterTabParam = takeFirst(searchParams?.masterTab);
  const reportTabParam = takeFirst(searchParams?.reportTab);

  const initialNavigation = {
    tab: isValidTab(tabParam) ? tabParam : 'dashboard',
    moreTab: isValidMoreTab(moreTabParam) ? moreTabParam : 'history',
    masterTab: isValidMasterTab(masterTabParam) ? masterTabParam : 'products',
    reportTab: isValidReportTab(reportTabParam) ? reportTabParam : 'analytics',
  };
  const headerLabel = 'Outlet/Cabang';
  const headerTitle = `${context.tenantName} (${getRoleLabel(context.membershipRole)})`;

  return (
    <InventoryApp
      initialNavigation={initialNavigation}
      headerLabel={headerLabel}
      headerTitle={headerTitle}
      tenantSlug={params.tenantSlug}
      membershipRole={context.membershipRole}
      accessibleBranchIds={context.accessibleBranchIds}
      currentUserSession={session}
      isReadOnly={context.isReadOnly}
      subscriptionStatus={context.subscriptionStatus}
      trialEndAt={context.trialEndAt}
    />
  );
}
