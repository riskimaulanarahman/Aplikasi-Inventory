import { OutletStockRecord } from '@/lib/types';

export function getOutletStock(records: OutletStockRecord[], outletId: string, productId: string): number {
  return records.find((record) => record.outletId === outletId && record.productId === productId)?.qty ?? 0;
}

export function upsertOutletStock(
  records: OutletStockRecord[],
  outletId: string,
  productId: string,
  qty: number,
): OutletStockRecord[] {
  const index = records.findIndex(
    (record) => record.outletId === outletId && record.productId === productId,
  );

  if (qty <= 0) {
    if (index === -1) {
      return records;
    }

    return records.filter((record, recordIndex) => recordIndex !== index);
  }

  if (index === -1) {
    return [...records, { outletId, productId, qty }];
  }

  const next = [...records];
  next[index] = {
    ...next[index],
    qty,
  };

  return next;
}
