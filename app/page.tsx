import InventoryApp from '@/components/inventory/InventoryApp';
import { MasterTab, MoreTab, ReportTab, TabKey } from '@/components/inventory/types';

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
  return value === 'products' || value === 'categories' || value === 'units' || value === 'outlets';
}

function isValidReportTab(value: string | null): value is ReportTab {
  return value === 'analytics' || value === 'export' || value === 'item-report';
}

export default function Page({ searchParams }: { searchParams?: SearchParams }) {
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

  return <InventoryApp initialNavigation={initialNavigation} />;
}
