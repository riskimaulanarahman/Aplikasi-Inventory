'use client';

import { clientApiFetch } from '@/lib/api/client';
import type { Category, Movement, Outlet, OutletStockRecord, Product, TransferRecord, Unit } from '@/lib/types';
import type { StockLocation } from '@/lib/types';
import type { LocationFilter } from '@/components/inventory/types';

export interface InventorySnapshot {
  categories: Category[];
  units: Unit[];
  products: Product[];
  outlets: Outlet[];
  outletStocks: OutletStockRecord[];
  movements: Movement[];
  transfers: TransferRecord[];
}

export interface DashboardAlertItem {
  productId: string;
  name: string;
  sku: string;
  currentStock: number;
  minimumLowStock: number;
  gap: number;
  locationKind: 'central' | 'outlet';
  locationKey: 'central' | `outlet:${string}`;
  locationLabel: string;
  outletId?: string;
}

export interface DashboardAlertsResponse {
  locationFilter: LocationFilter;
  lowStockCount: number;
  lowStockPriorities: DashboardAlertItem[];
  asOf: string;
}

function normalizeApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message;
  }

  if ('error' in payload) {
    const error = payload.error;
    if (typeof error === 'string' && error.trim() !== '') {
      return error;
    }
    if (error && typeof error === 'object') {
      const firstEntry = Object.values(error as Record<string, unknown>)[0];
      if (Array.isArray(firstEntry) && typeof firstEntry[0] === 'string') {
        return firstEntry[0];
      }
      if (typeof firstEntry === 'string') {
        return firstEntry;
      }
    }
  }

  return fallback;
}

async function requestJson<T>(path: string, init: RequestInit = {}, fallbackError = 'Terjadi kesalahan pada server.'): Promise<T> {
  const response = await clientApiFetch(path, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(normalizeApiError(payload, fallbackError));
  }

  return payload as T;
}

function encodeTenantSlug(tenantSlug: string): string {
  return encodeURIComponent(tenantSlug);
}

export async function getInventorySnapshot(tenantSlug: string): Promise<InventorySnapshot> {
  return requestJson<InventorySnapshot>(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/snapshot`,
    { method: 'GET' },
    'Gagal memuat data inventory.',
  );
}

export async function getDashboardAlerts(
  tenantSlug: string,
  {
    locationFilter,
    limit = 5,
  }: {
    locationFilter: LocationFilter;
    limit?: number;
  },
): Promise<DashboardAlertsResponse> {
  const params = new URLSearchParams({
    location: locationFilter,
    limit: `${limit}`,
  });

  return requestJson<DashboardAlertsResponse>(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/dashboard/alerts?${params.toString()}`,
    { method: 'GET' },
    'Gagal memuat alert dashboard.',
  );
}

export async function createCategory(tenantSlug: string, payload: { name: string }): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/categories`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menambah kategori.',
  );
}

export async function updateCategory(tenantSlug: string, categoryId: string, payload: { name: string }): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui kategori.',
  );
}

export async function deleteCategory(tenantSlug: string, categoryId: string): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE' },
    'Gagal menghapus kategori.',
  );
}

export async function createUnit(tenantSlug: string, payload: { name: string }): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/units`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menambah satuan.',
  );
}

export async function updateUnit(tenantSlug: string, unitId: string, payload: { name: string }): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/units/${encodeURIComponent(unitId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui satuan.',
  );
}

export async function deleteUnit(tenantSlug: string, unitId: string): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/units/${encodeURIComponent(unitId)}`,
    { method: 'DELETE' },
    'Gagal menghapus satuan.',
  );
}

export async function createProduct(tenantSlug: string, payload: {
  name: string;
  sku: string;
  initialStock: number;
  minimumLowStock: number;
  categoryId: string;
  unitId: string;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/products`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menambah produk.',
  );
}

export async function updateProduct(tenantSlug: string, productId: string, payload: {
  name: string;
  sku: string;
  minimumLowStock: number;
  categoryId: string;
  unitId: string;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/products/${encodeURIComponent(productId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui produk.',
  );
}

export async function deleteProduct(tenantSlug: string, productId: string): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/products/${encodeURIComponent(productId)}`,
    { method: 'DELETE' },
    'Gagal menghapus produk.',
  );
}

export async function createOutlet(tenantSlug: string, payload: {
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/outlets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menambah outlet.',
  );
}

export async function updateOutlet(tenantSlug: string, outletId: string, payload: {
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/outlets/${encodeURIComponent(outletId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui outlet.',
  );
}

export async function deleteOutlet(tenantSlug: string, outletId: string): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/outlets/${encodeURIComponent(outletId)}`,
    { method: 'DELETE' },
    'Gagal menghapus outlet.',
  );
}

export async function submitMovement(tenantSlug: string, payload: {
  productId: string;
  qty: number;
  type: 'in' | 'out';
  note: string;
  location: StockLocation;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/movements`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menyimpan transaksi stok.',
  );
}

export async function submitOpname(tenantSlug: string, payload: {
  productId: string;
  actualStock: number;
  note: string;
  location: StockLocation;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/opname`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menyimpan opname.',
  );
}

export async function submitTransfer(tenantSlug: string, payload: {
  productId: string;
  source: StockLocation;
  destinations: Array<{ outletId: string; qty: number }>;
  note: string;
}): Promise<void> {
  await requestJson(
    `/api/inventory/${encodeTenantSlug(tenantSlug)}/transfers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal menyimpan transfer.',
  );
}
