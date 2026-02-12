import {
  Category,
  Movement,
  Outlet,
  OutletStockRecord,
  Product,
  TransferRecord
} from "@/lib/types";

export const initialCategories: Category[] = [
  { id: "c-1", name: "Alat Tulis" },
  { id: "c-2", name: "Kemasan" },
  { id: "c-3", name: "Aksesoris Kantor" }
];

export const initialProducts: Product[] = [
  { id: "p-1", name: "Buku Catatan A5", sku: "NB-A5", stock: 40, categoryId: "c-1" },
  { id: "p-2", name: "Spidol Hitam", sku: "MK-BLK", stock: 65, categoryId: "c-1" },
  { id: "p-3", name: "Lakban Kemasan", sku: "PK-TAP", stock: 22, categoryId: "c-2" }
];

export const initialOutlets: Outlet[] = [
  {
    id: "o-1",
    name: "Outlet Kebon Jeruk",
    code: "KBJ",
    address: "Jl. Panjang No. 88, Jakarta Barat",
    latitude: -6.2014,
    longitude: 106.7627
  },
  {
    id: "o-2",
    name: "Outlet Cibubur",
    code: "CBB",
    address: "Jl. Alternatif Cibubur No. 19, Kota Bekasi",
    latitude: -6.3725,
    longitude: 106.9024
  }
];

export const initialOutletStocks: OutletStockRecord[] = [
  { outletId: "o-1", productId: "p-1", qty: 7 },
  { outletId: "o-1", productId: "p-2", qty: 15 },
  { outletId: "o-2", productId: "p-3", qty: 8 }
];

export const initialMovements: Movement[] = [
  {
    id: "m-1",
    productId: "p-1",
    productName: "Buku Catatan A5",
    qty: 40,
    type: "in",
    note: "Stok awal",
    delta: 40,
    balanceAfter: 40,
    locationKind: "central",
    locationId: "central",
    locationLabel: "Pusat",
    createdAt: "2026-02-11T09:00:00.000Z"
  },
  {
    id: "m-2",
    productId: "p-2",
    productName: "Spidol Hitam",
    qty: 65,
    type: "in",
    note: "Stok awal",
    delta: 65,
    balanceAfter: 65,
    locationKind: "central",
    locationId: "central",
    locationLabel: "Pusat",
    createdAt: "2026-02-11T09:10:00.000Z"
  },
  {
    id: "m-3",
    productId: "p-3",
    productName: "Lakban Kemasan",
    qty: 22,
    type: "in",
    note: "Stok awal",
    delta: 22,
    balanceAfter: 22,
    locationKind: "central",
    locationId: "central",
    locationLabel: "Pusat",
    createdAt: "2026-02-11T09:20:00.000Z"
  }
];

export const initialTransfers: TransferRecord[] = [];
