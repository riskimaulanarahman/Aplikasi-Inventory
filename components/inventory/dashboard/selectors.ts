import { DashboardPeriod, LocationFilter } from '@/components/inventory/types';
import { isMovementInLocation } from '@/components/inventory/utils/location';
import {
	Movement,
	Outlet,
	OutletStockRecord,
	Product,
	TransferRecord,
} from '@/lib/types';

export interface DashboardKpis {
	scopeStock: number;
	inQty: number;
	outQty: number;
	netQty: number;
	opnameEvents: number;
	lowStockCount: number;
}

export interface LowStockPriority {
	productId: string;
	name: string;
	sku: string;
	currentStock: number;
	minimumLowStock: number;
	gap: number;
}

export interface DashboardActivityFeedItem {
	id: string;
	kind: 'movement' | 'transfer';
	typeLabel: 'IN' | 'OUT' | 'OPNAME' | 'TRANSFER';
	createdAt: string;
	title: string;
	subtitle: string;
	qtyText: string;
}

export interface TopActiveProduct {
	productId: string;
	name: string;
	sku: string;
	events: number;
	totalQty: number;
}

export interface OutletActivitySummary {
	outletId: string;
	outletName: string;
	outletCode: string;
	totalStock: number;
	movementEvents: number;
	transferEvents: number;
	totalEvents: number;
}

export interface InactiveProduct {
	productId: string;
	name: string;
	sku: string;
	daysInactive: number;
}

function getPeriodStartMs(period: DashboardPeriod, nowMs: number) {
	const now = new Date(nowMs);
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();

	if (period === 'today') {
		return startOfToday;
	}

	const days = period === 'last7days' ? 6 : 29;
	return startOfToday - days * 24 * 60 * 60 * 1000;
}

function isTransferInLocation(transfer: TransferRecord, locationFilter: LocationFilter) {
	if (locationFilter === 'all') {
		return true;
	}

	if (locationFilter === 'central') {
		return transfer.sourceKind === 'central';
	}

	const outletId = locationFilter.slice('outlet:'.length);
	const fromOutlet = transfer.sourceKind === 'outlet' && transfer.sourceOutletId === outletId;
	const toOutlet = transfer.destinations.some(
		(destination) => destination.outletId === outletId,
	);

	return fromOutlet || toOutlet;
}

function getOutletTotalStock(outletStocks: OutletStockRecord[], outletId: string) {
	return outletStocks
		.filter((record) => record.outletId === outletId)
		.reduce((sum, record) => sum + record.qty, 0);
}

function getScopeStockTotal(
	products: Product[],
	outletStocks: OutletStockRecord[],
	locationFilter: LocationFilter,
) {
	if (locationFilter === 'central') {
		return products.reduce((sum, product) => sum + product.stock, 0);
	}

	if (locationFilter.startsWith('outlet:')) {
		const outletId = locationFilter.slice('outlet:'.length);
		return getOutletTotalStock(outletStocks, outletId);
	}

	const central = products.reduce((sum, product) => sum + product.stock, 0);
	const outlets = outletStocks.reduce((sum, record) => sum + record.qty, 0);
	return central + outlets;
}

export function filterMovementsByPeriodAndLocation(
	movements: Movement[],
	period: DashboardPeriod,
	locationFilter: LocationFilter,
	nowMs = Date.now(),
) {
	const startMs = getPeriodStartMs(period, nowMs);

	return movements.filter((movement) => {
		if (!isMovementInLocation(movement, locationFilter)) {
			return false;
		}
		const createdAtMs = new Date(movement.createdAt).getTime();
		return createdAtMs >= startMs && createdAtMs <= nowMs;
	});
}

export function filterTransfersByPeriodAndLocation(
	transfers: TransferRecord[],
	period: DashboardPeriod,
	locationFilter: LocationFilter,
	nowMs = Date.now(),
) {
	const startMs = getPeriodStartMs(period, nowMs);

	return transfers.filter((transfer) => {
		if (!isTransferInLocation(transfer, locationFilter)) {
			return false;
		}
		const createdAtMs = new Date(transfer.createdAt).getTime();
		return createdAtMs >= startMs && createdAtMs <= nowMs;
	});
}

export function buildDashboardKpis({
	products,
	outletStocks,
	movements,
	period,
	locationFilter,
	nowMs = Date.now(),
}: {
	products: Product[];
	outletStocks: OutletStockRecord[];
	movements: Movement[];
	period: DashboardPeriod;
	locationFilter: LocationFilter;
	nowMs?: number;
}): DashboardKpis {
	const scopedMovements = filterMovementsByPeriodAndLocation(
		movements,
		period,
		locationFilter,
		nowMs,
	);

	const inQty = scopedMovements
		.filter((movement) => movement.type === 'in')
		.reduce((sum, movement) => sum + movement.qty, 0);
	const outQty = scopedMovements
		.filter((movement) => movement.type === 'out')
		.reduce((sum, movement) => sum + movement.qty, 0);
	const opnameEvents = scopedMovements.filter(
		(movement) => movement.type === 'opname',
	).length;
	const lowStockCount = products.filter(
		(product) => product.stock <= product.minimumLowStock,
	).length;

	return {
		scopeStock: getScopeStockTotal(products, outletStocks, locationFilter),
		inQty,
		outQty,
		netQty: inQty - outQty,
		opnameEvents,
		lowStockCount,
	};
}

export function buildLowStockPriorities(products: Product[], limit = 5) {
	return products
		.filter((product) => product.stock <= product.minimumLowStock)
		.map<LowStockPriority>((product) => ({
			productId: product.id,
			name: product.name,
			sku: product.sku,
			currentStock: product.stock,
			minimumLowStock: product.minimumLowStock,
			gap: Math.max(0, product.minimumLowStock - product.stock),
		}))
		.sort((a, b) => {
			if (b.gap !== a.gap) {
				return b.gap - a.gap;
			}
			return a.name.localeCompare(b.name, 'id');
		})
		.slice(0, limit);
}

export function buildRecentActivityFeed({
	movements,
	transfers,
	period,
	locationFilter,
	limit = 10,
	nowMs = Date.now(),
}: {
	movements: Movement[];
	transfers: TransferRecord[];
	period: DashboardPeriod;
	locationFilter: LocationFilter;
	limit?: number;
	nowMs?: number;
}): DashboardActivityFeedItem[] {
	const movementItems = filterMovementsByPeriodAndLocation(
		movements,
		period,
		locationFilter,
		nowMs,
	).map<DashboardActivityFeedItem>((movement) => {
		const typeLabel =
			movement.type === 'in'
				? 'IN'
				: movement.type === 'out'
					? 'OUT'
					: 'OPNAME';
		return {
			id: `movement:${movement.id}`,
			kind: 'movement',
			typeLabel,
			createdAt: movement.createdAt,
			title: movement.productName,
			subtitle: `${movement.locationLabel} | ${movement.note}`,
			qtyText: `${movement.qty}`,
		};
	});

	const transferItems = filterTransfersByPeriodAndLocation(
		transfers,
		period,
		locationFilter,
		nowMs,
	).map<DashboardActivityFeedItem>((transfer) => ({
		id: `transfer:${transfer.id}`,
		kind: 'transfer',
		typeLabel: 'TRANSFER',
		createdAt: transfer.createdAt,
		title: transfer.productName,
		subtitle: `${transfer.sourceLabel} -> ${transfer.destinations
			.map((destination) => destination.outletName)
			.join(', ')}`,
		qtyText: `${transfer.totalQty}`,
	}));

	return [...movementItems, ...transferItems]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, limit);
}

export function buildTopActiveProducts({
	products,
	movements,
	period,
	locationFilter,
	limit = 5,
	nowMs = Date.now(),
}: {
	products: Product[];
	movements: Movement[];
	period: DashboardPeriod;
	locationFilter: LocationFilter;
	limit?: number;
	nowMs?: number;
}): TopActiveProduct[] {
	const scopedMovements = filterMovementsByPeriodAndLocation(
		movements,
		period,
		locationFilter,
		nowMs,
	);
	const productMap = products.reduce<Record<string, Product>>(
		(accumulator, product) => {
			accumulator[product.id] = product;
			return accumulator;
		},
		{},
	);

	const aggregated = scopedMovements.reduce<
		Record<string, { events: number; totalQty: number }>
	>((accumulator, movement) => {
		if (!productMap[movement.productId]) {
			return accumulator;
		}

		const current = accumulator[movement.productId] ?? { events: 0, totalQty: 0 };
		accumulator[movement.productId] = {
			events: current.events + 1,
			totalQty: current.totalQty + movement.qty,
		};
		return accumulator;
	}, {});

	return Object.entries(aggregated)
		.map<TopActiveProduct>(([productId, value]) => ({
			productId,
			name: productMap[productId].name,
			sku: productMap[productId].sku,
			events: value.events,
			totalQty: value.totalQty,
		}))
		.sort((a, b) => {
			if (b.events !== a.events) {
				return b.events - a.events;
			}
			if (b.totalQty !== a.totalQty) {
				return b.totalQty - a.totalQty;
			}
			return a.name.localeCompare(b.name, 'id');
		})
		.slice(0, limit);
}

export function buildOutletActivitySummaries({
	outlets,
	outletStocks,
	movements,
	transfers,
	period,
	locationFilter,
	nowMs = Date.now(),
}: {
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	movements: Movement[];
	transfers: TransferRecord[];
	period: DashboardPeriod;
	locationFilter: LocationFilter;
	nowMs?: number;
}): OutletActivitySummary[] {
	const scopedOutlets =
		locationFilter.startsWith('outlet:')
			? outlets.filter(
					(outlet) => outlet.id === locationFilter.slice('outlet:'.length),
				)
			: locationFilter === 'central'
				? []
				: outlets;

	const scopedMovements = filterMovementsByPeriodAndLocation(
		movements,
		period,
		'all',
		nowMs,
	).filter((movement) => movement.locationKind === 'outlet');

	const scopedTransfers = filterTransfersByPeriodAndLocation(
		transfers,
		period,
		'all',
		nowMs,
	);

	return scopedOutlets
		.map<OutletActivitySummary>((outlet) => {
			const movementEvents = scopedMovements.filter(
				(movement) => movement.locationId === outlet.id,
			).length;
			const transferEvents = scopedTransfers.filter((transfer) => {
				const sourceMatch =
					transfer.sourceKind === 'outlet' && transfer.sourceOutletId === outlet.id;
				const destinationMatch = transfer.destinations.some(
					(destination) => destination.outletId === outlet.id,
				);
				return sourceMatch || destinationMatch;
			}).length;
			const totalEvents = movementEvents + transferEvents;

			return {
				outletId: outlet.id,
				outletName: outlet.name,
				outletCode: outlet.code,
				totalStock: getOutletTotalStock(outletStocks, outlet.id),
				movementEvents,
				transferEvents,
				totalEvents,
			};
		})
		.sort((a, b) => {
			if (b.totalEvents !== a.totalEvents) {
				return b.totalEvents - a.totalEvents;
			}
			if (b.totalStock !== a.totalStock) {
				return b.totalStock - a.totalStock;
			}
			return a.outletName.localeCompare(b.outletName, 'id');
		});
}

export function buildInactiveProducts({
	products,
	movements,
	locationFilter,
	limit = 5,
	nowMs = Date.now(),
}: {
	products: Product[];
	movements: Movement[];
	locationFilter: LocationFilter;
	limit?: number;
	nowMs?: number;
}): InactiveProduct[] {
	const last30Days = filterMovementsByPeriodAndLocation(
		movements,
		'last30days',
		locationFilter,
		nowMs,
	);
	const activeProductIds = new Set(last30Days.map((movement) => movement.productId));
	const latestMovementAt = movements
		.filter((movement) => isMovementInLocation(movement, locationFilter))
		.reduce<Record<string, string>>((accumulator, movement) => {
			const current = accumulator[movement.productId];
			if (!current || movement.createdAt > current) {
				accumulator[movement.productId] = movement.createdAt;
			}
			return accumulator;
		}, {});

	return products
		.filter((product) => !activeProductIds.has(product.id))
		.map<InactiveProduct>((product) => {
			const lastMovementAt = latestMovementAt[product.id];
			if (!lastMovementAt) {
				return {
					productId: product.id,
					name: product.name,
					sku: product.sku,
					daysInactive: 999,
				};
			}
			const diffMs = Math.max(
				0,
				nowMs - new Date(lastMovementAt).getTime(),
			);
			const daysInactive = Math.floor(diffMs / (24 * 60 * 60 * 1000));
			return {
				productId: product.id,
				name: product.name,
				sku: product.sku,
				daysInactive,
			};
		})
		.sort((a, b) => b.daysInactive - a.daysInactive)
		.slice(0, limit);
}
