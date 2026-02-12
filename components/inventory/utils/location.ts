import { LocationKey, Movement, Outlet, StockLocation } from '@/lib/types';
import { LocationFilter } from '@/components/inventory/types';

export function toLocationFilterOptions(outlets: Outlet[]) {
  return [
    { value: 'all' as const, label: 'Semua Lokasi' },
    { value: 'central' as const, label: 'Pusat' },
    ...outlets.map((outlet) => ({
      value: `outlet:${outlet.id}` as const,
      label: `${outlet.name} (${outlet.code})`,
    })),
  ];
}

export function getLocationFilterLabel(filter: LocationFilter, outlets: Outlet[]) {
  if (filter === 'all') {
    return 'Semua Lokasi';
  }

  if (filter === 'central') {
    return 'Pusat';
  }

  const outletId = filter.slice('outlet:'.length);
  const outlet = outlets.find((item) => item.id === outletId);
  return outlet ? `${outlet.name} (${outlet.code})` : 'Outlet tidak dikenal';
}

export function isMovementInLocation(movement: Movement, locationFilter: LocationFilter) {
  if (locationFilter === 'all') {
    return true;
  }

  if (locationFilter === 'central') {
    return movement.locationKind === 'central';
  }

  const outletId = locationFilter.slice('outlet:'.length);
  return movement.locationKind === 'outlet' && movement.locationId === outletId;
}

export function getLocationLabel(outlets: Outlet[], location: StockLocation) {
  if (location.kind === 'central') {
    return 'Pusat';
  }

  const target = outlets.find((outlet) => outlet.id === location.outletId);
  return target ? `${target.name} (${target.code})` : 'Outlet tidak dikenal';
}

export function toLocationKey(location: StockLocation): LocationKey {
  if (location.kind === 'central') {
    return 'central';
  }

  return `outlet:${location.outletId ?? 'unknown'}`;
}
