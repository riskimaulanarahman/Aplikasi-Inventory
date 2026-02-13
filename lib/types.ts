export type MovementType = "in" | "out" | "opname";

export interface Category {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minimumLowStock: number;
  categoryId: string;
  unitId: string;
}

export interface Outlet {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface StockLocation {
  kind: "central" | "outlet";
  outletId?: string;
  outletName?: string;
}

export interface Movement {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  type: MovementType;
  note: string;
  delta: number;
  balanceAfter: number;
  locationKind: "central" | "outlet";
  locationId: string;
  locationLabel: string;
  countedStock?: number;
  createdAt: string;
}

export interface TransferDestination {
  outletId: string;
  outletName: string;
  qty: number;
}

export interface TransferRecord {
  id: string;
  productId: string;
  productName: string;
  sourceKind: "central" | "outlet";
  sourceOutletId?: string;
  sourceLabel: string;
  destinations: TransferDestination[];
  totalQty: number;
  note: string;
  createdAt: string;
}

export interface OutletStockRecord {
  outletId: string;
  productId: string;
  qty: number;
}

export type LocationKey = "central" | `outlet:${string}`;
export type FavoriteState = Record<LocationKey, string[]>;
export type UsageState = Record<LocationKey, Record<string, number>>;
