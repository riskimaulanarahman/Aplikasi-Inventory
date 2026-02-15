import {
  FavoriteState,
  LocationKey,
  Movement,
  Outlet,
  Product,
  UsageState,
} from '@/lib/types';

export function getProductUnitLabel(product: Product, unitNameById: Record<string, string>) {
  return unitNameById[product.unitId] ?? '-';
}

export function prioritizeProducts(
  products: Product[],
  locationKey: LocationKey,
  favoritesByLocation: FavoriteState,
  usageByLocation: UsageState,
) {
  const favoriteSet = new Set(favoritesByLocation[locationKey] ?? []);
  const usageMap = usageByLocation[locationKey] ?? {};

  return [...products].sort((a, b) => {
    const favoriteWeight = Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id));
    if (favoriteWeight !== 0) {
      return favoriteWeight;
    }

    const usageWeight = (usageMap[b.id] ?? 0) - (usageMap[a.id] ?? 0);
    if (usageWeight !== 0) {
      return usageWeight;
    }

    return a.name.localeCompare(b.name, 'id');
  });
}

export function buildInitialUsage(movements: Movement[]): UsageState {
  const usage: UsageState = {
    central: {},
  };

  for (const movement of movements) {
    const key: LocationKey = movement.locationKind === 'central' ? 'central' : `outlet:${movement.locationId}`;

    if (!usage[key]) {
      usage[key] = {};
    }

    usage[key][movement.productId] = (usage[key][movement.productId] ?? 0) + 1;
  }

  return usage;
}

export function buildSkuFromName(name: string, existingProducts: Product[], excludedProductId?: string): string {
  const normalized = name
    .trim()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized.split(' ').filter(Boolean);
  const base = tokens.length > 0 ? tokens.map((token) => token.slice(0, 3)).join('-').slice(0, 16) : 'PRD';
  const usedSku = new Set(
    existingProducts
      .filter((product) => product.id !== excludedProductId)
      .map((product) => product.sku.trim().toUpperCase()),
  );

  if (!usedSku.has(base)) {
    return base;
  }

  let serial = 2;
  let candidate = `${base}-${serial}`;

  while (usedSku.has(candidate)) {
    serial += 1;
    candidate = `${base}-${serial}`;
  }

  return candidate;
}

export function buildOutletCodeFromName(
  name: string,
  existingOutlets: Outlet[],
  excludedOutletId?: string,
): string {
  const normalized = name
    .trim()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized.split(' ').filter(Boolean);
  const base = tokens.length > 0 ? tokens.map((token) => token.slice(0, 3)).join('-').slice(0, 16) : 'OUT';
  const usedCode = new Set(
    existingOutlets
      .filter((outlet) => outlet.id !== excludedOutletId)
      .map((outlet) => outlet.code.trim().toUpperCase()),
  );

  if (!usedCode.has(base)) {
    return base;
  }

  let serial = 2;
  let candidate = `${base}-${serial}`;

  while (usedCode.has(candidate)) {
    serial += 1;
    candidate = `${base}-${serial}`;
  }

  return candidate;
}
