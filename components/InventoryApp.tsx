'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import BottomNav from '@/components/BottomNav';
import {
	initialCategories,
	initialMovements,
	initialOutlets,
	initialOutletStocks,
	initialProducts,
	initialTransfers,
	initialUnits,
} from '@/lib/mockData';
import {
	Category,
	FavoriteState,
	LocationKey,
	Movement,
	MovementType,
	Outlet,
	OutletStockRecord,
	Product,
	StockLocation,
	TransferRecord,
	Unit,
	UsageState,
} from '@/lib/types';

const OutletMapPicker = dynamic(() => import('@/components/OutletMapPicker'), {
	ssr: false,
	loading: () => (
		<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
			Memuat peta...
		</div>
	),
});

export type TabKey = 'dashboard' | 'in' | 'out' | 'more';
export type PageTone = 'sky' | 'teal' | 'red' | 'orange' | 'violet';

type MoreTab =
	| 'history'
	| 'master'
	| 'outlets'
	| 'transfer'
	| 'opname'
	| 'analytics'
	| 'export';
type MasterTab = 'products' | 'categories' | 'units';
type HistoryFilter = 'all' | MovementType;
type ToastTone = 'success' | 'error';
type PageSize = 5 | 10 | 20;
type AnalyticsPeriod = 'last30days' | 'monthly' | 'yearly';
type LocationFilter = 'all' | 'central' | `outlet:${string}`;

interface ToastState {
	id: number;
	tone: ToastTone;
	message: string;
}

interface GeocodeResult {
	display_name: string;
	lat: string;
	lon: string;
}

const PAGE_SIZE_OPTIONS: PageSize[] = [5, 10, 20];

const PAGE_TONE_STYLES: Record<
	PageTone,
	{
		pageBackground: string;
		header: string;
		tabActive: string;
		solidButton: string;
		solidButtonHover: string;
		dialogActive: string;
		dialogActiveText: string;
	}
> = {
	sky: {
		pageBackground: 'bg-gradient-to-b from-sky-100 via-sky-50 to-white',
		header: 'bg-sky-700 shadow-[0_18px_35px_rgba(3,105,161,0.34)]',
		tabActive: 'bg-sky-600 text-white',
		solidButton: 'bg-sky-600 text-white',
		solidButtonHover: 'hover:bg-sky-700',
		dialogActive: 'border-sky-600 bg-sky-600 text-white',
		dialogActiveText: 'text-sky-100',
	},
	teal: {
		pageBackground: 'bg-gradient-to-b from-teal-100 via-teal-50 to-white',
		header: 'bg-teal-700 shadow-[0_18px_35px_rgba(15,118,110,0.34)]',
		tabActive: 'bg-teal-600 text-white',
		solidButton: 'bg-teal-600 text-white',
		solidButtonHover: 'hover:bg-teal-700',
		dialogActive: 'border-teal-600 bg-teal-600 text-white',
		dialogActiveText: 'text-teal-100',
	},
	red: {
		pageBackground: 'bg-gradient-to-b from-rose-100 via-rose-50 to-white',
		header: 'bg-rose-700 shadow-[0_18px_35px_rgba(190,24,93,0.33)]',
		tabActive: 'bg-rose-600 text-white',
		solidButton: 'bg-rose-600 text-white',
		solidButtonHover: 'hover:bg-rose-700',
		dialogActive: 'border-rose-600 bg-rose-600 text-white',
		dialogActiveText: 'text-rose-100',
	},
	orange: {
		pageBackground: 'bg-gradient-to-b from-orange-100 via-amber-50 to-white',
		header: 'bg-orange-600 shadow-[0_18px_35px_rgba(234,88,12,0.33)]',
		tabActive: 'bg-orange-500 text-white',
		solidButton: 'bg-orange-500 text-white',
		solidButtonHover: 'hover:bg-orange-600',
		dialogActive: 'border-orange-500 bg-orange-500 text-white',
		dialogActiveText: 'text-orange-100',
	},
	violet: {
		pageBackground: 'bg-gradient-to-b from-violet-100 via-fuchsia-50 to-white',
		header: 'bg-violet-700 shadow-[0_18px_35px_rgba(109,40,217,0.34)]',
		tabActive: 'bg-violet-600 text-white',
		solidButton: 'bg-violet-600 text-white',
		solidButtonHover: 'hover:bg-violet-700',
		dialogActive: 'border-violet-600 bg-violet-600 text-white',
		dialogActiveText: 'text-violet-100',
	},
};

const DEFAULT_COORDINATES = {
	latitude: -6.2,
	longitude: 106.816666,
};

function padDatePart(value: number) {
	return value.toString().padStart(2, '0');
}

function formatDateKey(date: Date) {
	return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatMonthKey(date: Date) {
	return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
}

function toLocationFilterOptions(outlets: Outlet[]) {
	return [
		{ value: 'all' as const, label: 'Semua Lokasi' },
		{ value: 'central' as const, label: 'Pusat' },
		...outlets.map((outlet) => ({
			value: `outlet:${outlet.id}` as const,
			label: `${outlet.name} (${outlet.code})`,
		})),
	];
}

function getLocationFilterLabel(filter: LocationFilter, outlets: Outlet[]) {
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

function getProductUnitLabel(
	product: Product,
	unitNameById: Record<string, string>,
) {
	return unitNameById[product.unitId] ?? '-';
}

function parseIntegerInput(value: string, fallback = 0) {
	if (value.trim() === '') {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function isMovementInLocation(
	movement: Movement,
	locationFilter: LocationFilter,
) {
	if (locationFilter === 'all') {
		return true;
	}

	if (locationFilter === 'central') {
		return movement.locationKind === 'central';
	}

	const outletId = locationFilter.slice('outlet:'.length);
	return movement.locationKind === 'outlet' && movement.locationId === outletId;
}

function getLocationLabel(outlets: Outlet[], location: StockLocation) {
	if (location.kind === 'central') {
		return 'Pusat';
	}

	const target = outlets.find((outlet) => outlet.id === location.outletId);
	return target ? `${target.name} (${target.code})` : 'Outlet tidak dikenal';
}

function toLocationKey(location: StockLocation): LocationKey {
	if (location.kind === 'central') {
		return 'central';
	}

	return `outlet:${location.outletId ?? 'unknown'}`;
}

function getOutletStock(
	records: OutletStockRecord[],
	outletId: string,
	productId: string,
): number {
	return (
		records.find(
			(record) =>
				record.outletId === outletId && record.productId === productId,
		)?.qty ?? 0
	);
}

function upsertOutletStock(
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

function prioritizeProducts(
	products: Product[],
	locationKey: LocationKey,
	favoritesByLocation: FavoriteState,
	usageByLocation: UsageState,
) {
	const favoriteSet = new Set(favoritesByLocation[locationKey] ?? []);
	const usageMap = usageByLocation[locationKey] ?? {};

	return [...products].sort((a, b) => {
		const favoriteWeight =
			Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id));
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

function buildInitialUsage(movements: Movement[]): UsageState {
	const usage: UsageState = {
		central: {},
	};

	for (const movement of movements) {
		const key: LocationKey =
			movement.locationKind === 'central'
				? 'central'
				: `outlet:${movement.locationId}`;

		if (!usage[key]) {
			usage[key] = {};
		}

		usage[key][movement.productId] = (usage[key][movement.productId] ?? 0) + 1;
	}

	return usage;
}

function buildSkuFromName(
	name: string,
	existingProducts: Product[],
	excludedProductId?: string,
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
	const base =
		tokens.length > 0
			? tokens
					.map((token) => token.slice(0, 3))
					.join('-')
					.slice(0, 16)
			: 'PRD';
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

export default function InventoryApp() {
	const [categories, setCategories] = useState<Category[]>(initialCategories);
	const [units, setUnits] = useState<Unit[]>(initialUnits);
	const [products, setProducts] = useState<Product[]>(initialProducts);
	const [outlets, setOutlets] = useState<Outlet[]>(initialOutlets);
	const [outletStocks, setOutletStocks] =
		useState<OutletStockRecord[]>(initialOutletStocks);
	const [movements, setMovements] = useState<Movement[]>(initialMovements);
	const [transfers, setTransfers] =
		useState<TransferRecord[]>(initialTransfers);
	const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
	const [activeMoreTab, setActiveMoreTab] = useState<MoreTab>('history');
	const [activeMasterTab, setActiveMasterTab] = useState<MasterTab>('products');
	const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
	const [error, setError] = useState('');
	const [toast, setToast] = useState<ToastState | null>(null);
	const [eventPulse, setEventPulse] = useState(false);
	const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
	const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
	const [favoritesByLocation, setFavoritesByLocation] = useState<FavoriteState>(
		{
			central: [],
		},
	);
	const [usageByLocation, setUsageByLocation] = useState<UsageState>(
		buildInitialUsage(initialMovements),
	);
	const profileMenuRef = useRef<HTMLDivElement | null>(null);

	const [historyPage, setHistoryPage] = useState(1);
	const [historyPageSize, setHistoryPageSize] = useState<PageSize>(5);
	const [productPage, setProductPage] = useState(1);
	const [productPageSize, setProductPageSize] = useState<PageSize>(5);
	const [transferPage, setTransferPage] = useState(1);
	const [transferPageSize, setTransferPageSize] = useState<PageSize>(5);

	const categoryNameById = useMemo(() => {
		return categories.reduce<Record<string, string>>(
			(accumulator, category) => {
				accumulator[category.id] = category.name;
				return accumulator;
			},
			{},
		);
	}, [categories]);
	const unitNameById = useMemo(() => {
		return units.reduce<Record<string, string>>((accumulator, unit) => {
			accumulator[unit.id] = unit.name;
			return accumulator;
		}, {});
	}, [units]);

	const totalStokPusat = useMemo(
		() => products.reduce((sum, product) => sum + product.stock, 0),
		[products],
	);
	const totalStokOutlet = useMemo(
		() => outletStocks.reduce((sum, record) => sum + record.qty, 0),
		[outletStocks],
	);
	const totalStok = totalStokPusat + totalStokOutlet;

	const lowStockCount = useMemo(
		() => products.filter((product) => product.stock <= 10).length,
		[products],
	);

	const totalStockIn = useMemo(
		() =>
			movements
				.filter((movement) => movement.type === 'in')
				.reduce((sum, movement) => sum + movement.qty, 0),
		[movements],
	);

	const totalStockOut = useMemo(
		() =>
			movements
				.filter((movement) => movement.type === 'out')
				.reduce((sum, movement) => sum + movement.qty, 0),
		[movements],
	);

	const opnameEvents = useMemo(
		() => movements.filter((movement) => movement.type === 'opname').length,
		[movements],
	);

	const filteredMovements = useMemo(() => {
		if (historyFilter === 'all') {
			return movements;
		}
		return movements.filter((movement) => movement.type === historyFilter);
	}, [historyFilter, movements]);

	const historyTotalPages = Math.max(
		1,
		Math.ceil(filteredMovements.length / historyPageSize),
	);

	const pagedMovements = useMemo(() => {
		const safePage = Math.min(historyPage, historyTotalPages);
		const start = (safePage - 1) * historyPageSize;
		return filteredMovements.slice(start, start + historyPageSize);
	}, [filteredMovements, historyPage, historyPageSize, historyTotalPages]);

	const transferTotalPages = Math.max(
		1,
		Math.ceil(transfers.length / transferPageSize),
	);

	const pagedTransfers = useMemo(() => {
		const safePage = Math.min(transferPage, transferTotalPages);
		const start = (safePage - 1) * transferPageSize;
		return transfers.slice(start, start + transferPageSize);
	}, [transferPage, transferPageSize, transferTotalPages, transfers]);

	const activeTone = useMemo<PageTone>(() => {
		if (activeTab === 'dashboard') {
			return 'sky';
		}

		if (activeTab === 'in') {
			return 'teal';
		}

		if (activeTab === 'out') {
			return 'red';
		}

		if (activeMoreTab === 'opname') {
			return 'orange';
		}

		return 'violet';
	}, [activeMoreTab, activeTab]);

	const activeToneStyle = PAGE_TONE_STYLES[activeTone];

	useEffect(() => {
		if (!toast) {
			return;
		}

		const timer = window.setTimeout(() => {
			setToast(null);
		}, 2400);

		return () => window.clearTimeout(timer);
	}, [toast]);

	useEffect(() => {
		if (!eventPulse) {
			return;
		}

		const timer = window.setTimeout(() => {
			setEventPulse(false);
		}, 450);

		return () => window.clearTimeout(timer);
	}, [eventPulse]);

	useEffect(() => {
		setHistoryPage(1);
	}, [historyFilter, historyPageSize]);

	useEffect(() => {
		if (historyPage > historyTotalPages) {
			setHistoryPage(historyTotalPages);
		}
	}, [historyPage, historyTotalPages]);

	useEffect(() => {
		setTransferPage(1);
	}, [transferPageSize]);

	useEffect(() => {
		if (transferPage > transferTotalPages) {
			setTransferPage(transferTotalPages);
		}
	}, [transferPage, transferTotalPages]);

	useEffect(() => {
		if (!isProfileMenuOpen) {
			return;
		}

		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target || !profileMenuRef.current?.contains(target)) {
				setIsProfileMenuOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsProfileMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isProfileMenuOpen]);

	const pushToast = (message: string, tone: ToastTone) => {
		setToast({
			id: Date.now(),
			tone,
			message,
		});
	};

	const markError = (message: string) => {
		setError(message);
		pushToast(message, 'error');
		setEventPulse(true);
	};

	const markSuccess = (message: string) => {
		setError('');
		pushToast(message, 'success');
		setEventPulse(true);
	};

	const openMore = (tab: MoreTab) => {
		setActiveTab('more');
		setActiveMoreTab(tab);
	};

	const openMoreDialog = () => {
		setError('');
		setIsProfileMenuOpen(false);
		setIsMoreMenuOpen(true);
	};

	const selectMoreDialogItem = (tab: MoreTab) => {
		setError('');
		setIsProfileMenuOpen(false);
		setActiveMoreTab(tab);
		setActiveTab('more');
		setIsMoreMenuOpen(false);
	};

	const handleMainTabChange = (tab: TabKey) => {
		setError('');
		setIsMoreMenuOpen(false);
		setIsProfileMenuOpen(false);
		setActiveTab(tab);
	};

	const handleProfileClick = () => {
		setIsProfileMenuOpen(false);
		markSuccess('Fitur profil akan segera tersedia.');
	};

	const handleLogoutClick = () => {
		setIsProfileMenuOpen(false);
		markSuccess('Logout berhasil.');
	};

	const createMovement = (movement: Omit<Movement, 'id' | 'createdAt'>) => {
		setMovements((current) => [
			{
				...movement,
				id: createId(),
				createdAt: new Date().toISOString(),
			},
			...current,
		]);
	};

	const getStockByLocation = (productId: string, location: StockLocation) => {
		if (location.kind === 'central') {
			return products.find((product) => product.id === productId)?.stock ?? 0;
		}

		if (!location.outletId) {
			return 0;
		}

		return getOutletStock(outletStocks, location.outletId, productId);
	};

	const bumpUsage = (location: StockLocation, productId: string) => {
		const key = toLocationKey(location);

		setUsageByLocation((current) => {
			const usage = current[key] ?? {};
			return {
				...current,
				[key]: {
					...usage,
					[productId]: (usage[productId] ?? 0) + 1,
				},
			};
		});
	};

	const toggleFavoriteProduct = (
		location: StockLocation,
		productId: string,
	) => {
		const key = toLocationKey(location);

		setFavoritesByLocation((current) => {
			const currentItems = current[key] ?? [];
			const set = new Set(currentItems);

			if (set.has(productId)) {
				set.delete(productId);
			} else {
				set.add(productId);
			}

			return {
				...current,
				[key]: Array.from(set),
			};
		});
	};

	const handleStockMovement = ({
		productId,
		qty,
		type,
		note,
		location,
	}: {
		productId: string;
		qty: number;
		type: 'in' | 'out';
		note: string;
		location: StockLocation;
	}): boolean => {
		if (!Number.isInteger(qty) || qty <= 0) {
			markError('Jumlah harus bilangan bulat lebih dari 0.');
			return false;
		}

		const product = products.find((item) => item.id === productId);

		if (!product) {
			markError('Produk tidak ditemukan.');
			return false;
		}

		if (location.kind === 'outlet' && !location.outletId) {
			markError('Outlet harus dipilih.');
			return false;
		}

		const currentStock = getStockByLocation(productId, location);

		if (type === 'out' && qty > currentStock) {
			markError('Stok keluar gagal. Jumlah melebihi stok tersedia.');
			return false;
		}

		const delta = type === 'in' ? qty : -qty;
		const nextStock = currentStock + delta;

		if (location.kind === 'central') {
			setProducts((current) =>
				current.map((item) =>
					item.id === productId ? { ...item, stock: nextStock } : item,
				),
			);
		} else if (location.outletId) {
			setOutletStocks((current) =>
				upsertOutletStock(current, location.outletId!, productId, nextStock),
			);
		}

		createMovement({
			productId,
			productName: product.name,
			qty,
			type,
			note: note.trim() || (type === 'in' ? 'Stok masuk' : 'Stok keluar'),
			delta,
			balanceAfter: nextStock,
			locationKind: location.kind,
			locationId:
				location.kind === 'central'
					? 'central'
					: (location.outletId ?? 'unknown'),
			locationLabel: getLocationLabel(outlets, location),
		});

		bumpUsage(location, productId);
		openMore('history');
		markSuccess(
			type === 'in'
				? 'Transaksi stok masuk berhasil disimpan.'
				: 'Transaksi stok keluar berhasil disimpan.',
		);

		return true;
	};

	const handleOpname = ({
		productId,
		actualStock,
		note,
		location,
	}: {
		productId: string;
		actualStock: number;
		note: string;
		location: StockLocation;
	}): boolean => {
		if (!Number.isInteger(actualStock) || actualStock < 0) {
			markError('Stok fisik harus bilangan bulat dan tidak boleh negatif.');
			return false;
		}

		const product = products.find((item) => item.id === productId);

		if (!product) {
			markError('Produk tidak ditemukan untuk opname.');
			return false;
		}

		if (location.kind === 'outlet' && !location.outletId) {
			markError('Outlet harus dipilih.');
			return false;
		}

		const currentStock = getStockByLocation(productId, location);
		const delta = actualStock - currentStock;

		if (location.kind === 'central') {
			setProducts((current) =>
				current.map((item) =>
					item.id === productId ? { ...item, stock: actualStock } : item,
				),
			);
		} else if (location.outletId) {
			setOutletStocks((current) =>
				upsertOutletStock(current, location.outletId!, productId, actualStock),
			);
		}

		createMovement({
			productId,
			productName: product.name,
			qty: Math.abs(delta),
			type: 'opname',
			note: note.trim() || 'Penyesuaian stok opname',
			delta,
			balanceAfter: actualStock,
			countedStock: actualStock,
			locationKind: location.kind,
			locationId:
				location.kind === 'central'
					? 'central'
					: (location.outletId ?? 'unknown'),
			locationLabel: getLocationLabel(outlets, location),
		});

		bumpUsage(location, productId);
		openMore('history');

		if (delta === 0) {
			markSuccess('Opname tersimpan. Tidak ada perubahan stok.');
		} else {
			markSuccess('Opname tersimpan dengan penyesuaian stok.');
		}

		return true;
	};

	const handleCreateCategory = ({ name }: { name: string }): boolean => {
		const cleanedName = name.trim();

		if (!cleanedName) {
			markError('Nama kategori wajib diisi.');
			return false;
		}

		const duplicate = categories.some(
			(category) =>
				category.name.trim().toLowerCase() === cleanedName.toLowerCase(),
		);

		if (duplicate) {
			markError('Kategori sudah ada. Gunakan nama lain.');
			return false;
		}

		setCategories((current) => [
			...current,
			{ id: createId(), name: cleanedName },
		]);
		markSuccess('Kategori berhasil ditambahkan.');
		return true;
	};

	const handleUpdateCategory = ({
		categoryId,
		name,
	}: {
		categoryId: string;
		name: string;
	}): boolean => {
		const cleanedName = name.trim();

		if (!categories.some((category) => category.id === categoryId)) {
			markError('Kategori tidak ditemukan.');
			return false;
		}

		if (!cleanedName) {
			markError('Nama kategori wajib diisi.');
			return false;
		}

		const duplicate = categories.some(
			(category) =>
				category.id !== categoryId &&
				category.name.trim().toLowerCase() === cleanedName.toLowerCase(),
		);

		if (duplicate) {
			markError('Kategori sudah ada. Gunakan nama lain.');
			return false;
		}

		setCategories((current) =>
			current.map((category) =>
				category.id === categoryId
					? { ...category, name: cleanedName }
					: category,
			),
		);

		markSuccess('Kategori berhasil diperbarui.');
		return true;
	};

	const handleDeleteCategory = (categoryId: string): boolean => {
		const target = categories.find((category) => category.id === categoryId);

		if (!target) {
			markError('Kategori tidak ditemukan.');
			return false;
		}

		const used = products.some((product) => product.categoryId === categoryId);

		if (used) {
			markError('Kategori tidak bisa dihapus karena masih dipakai produk.');
			return false;
		}

		setCategories((current) =>
			current.filter((category) => category.id !== categoryId),
		);
		markSuccess('Kategori berhasil dihapus.');
		return true;
	};

	const handleCreateUnit = ({ name }: { name: string }): boolean => {
		const cleanedName = name.trim();

		if (!cleanedName) {
			markError('Nama satuan wajib diisi.');
			return false;
		}

		const duplicate = units.some(
			(unit) => unit.name.trim().toLowerCase() === cleanedName.toLowerCase(),
		);
		if (duplicate) {
			markError('Satuan sudah ada. Gunakan nama lain.');
			return false;
		}

		setUnits((current) => [...current, { id: createId(), name: cleanedName }]);
		markSuccess('Satuan berhasil ditambahkan.');
		return true;
	};

	const handleUpdateUnit = ({
		unitId,
		name,
	}: {
		unitId: string;
		name: string;
	}): boolean => {
		const cleanedName = name.trim();

		if (!units.some((unit) => unit.id === unitId)) {
			markError('Satuan tidak ditemukan.');
			return false;
		}

		if (!cleanedName) {
			markError('Nama satuan wajib diisi.');
			return false;
		}

		const duplicate = units.some(
			(unit) =>
				unit.id !== unitId &&
				unit.name.trim().toLowerCase() === cleanedName.toLowerCase(),
		);
		if (duplicate) {
			markError('Satuan sudah ada. Gunakan nama lain.');
			return false;
		}

		setUnits((current) =>
			current.map((unit) =>
				unit.id === unitId ? { ...unit, name: cleanedName } : unit,
			),
		);
		markSuccess('Satuan berhasil diperbarui.');
		return true;
	};

	const handleDeleteUnit = (unitId: string): boolean => {
		const target = units.find((unit) => unit.id === unitId);
		if (!target) {
			markError('Satuan tidak ditemukan.');
			return false;
		}

		const used = products.some((product) => product.unitId === unitId);
		if (used) {
			markError('Satuan tidak bisa dihapus karena masih dipakai produk.');
			return false;
		}

		setUnits((current) => current.filter((unit) => unit.id !== unitId));
		markSuccess('Satuan berhasil dihapus.');
		return true;
	};

	const handleCreateProduct = ({
		name,
		sku,
		initialStock,
		categoryId,
		unitId,
	}: {
		name: string;
		sku: string;
		initialStock: number;
		categoryId: string;
		unitId: string;
	}): boolean => {
		const cleanedName = name.trim();
		const cleanedSku = sku.trim().toUpperCase();

		if (!cleanedName || !cleanedSku) {
			markError('Nama produk dan SKU wajib diisi.');
			return false;
		}

		if (
			!categoryId ||
			!categories.some((category) => category.id === categoryId)
		) {
			markError('Kategori wajib dipilih.');
			return false;
		}
		if (!unitId || !units.some((unit) => unit.id === unitId)) {
			markError('Satuan wajib dipilih.');
			return false;
		}

		if (!Number.isInteger(initialStock) || initialStock < 0) {
			markError('Stok awal harus bilangan bulat dan tidak boleh negatif.');
			return false;
		}

		const duplicateSku = products.some(
			(product) => product.sku.trim().toUpperCase() === cleanedSku,
		);

		if (duplicateSku) {
			markError('SKU sudah terpakai. Gunakan SKU lain.');
			return false;
		}

		const newProduct: Product = {
			id: createId(),
			name: cleanedName,
			sku: cleanedSku,
			stock: initialStock,
			categoryId,
			unitId,
		};

		setProducts((current) => [...current, newProduct]);

		if (initialStock > 0) {
			createMovement({
				productId: newProduct.id,
				productName: newProduct.name,
				qty: initialStock,
				type: 'in',
				note: 'Stok awal produk',
				delta: initialStock,
				balanceAfter: initialStock,
				locationKind: 'central',
				locationId: 'central',
				locationLabel: 'Pusat',
			});
		}

		markSuccess('Produk berhasil ditambahkan.');
		return true;
	};

	const handleUpdateProduct = ({
		productId,
		name,
		sku,
		categoryId,
		unitId,
	}: {
		productId: string;
		name: string;
		sku: string;
		categoryId: string;
		unitId: string;
	}): boolean => {
		const cleanedName = name.trim();
		const cleanedSku = sku.trim().toUpperCase();

		if (!products.some((product) => product.id === productId)) {
			markError('Produk tidak ditemukan.');
			return false;
		}

		if (!cleanedName || !cleanedSku) {
			markError('Nama produk dan SKU wajib diisi.');
			return false;
		}

		if (
			!categoryId ||
			!categories.some((category) => category.id === categoryId)
		) {
			markError('Kategori wajib dipilih.');
			return false;
		}
		if (!unitId || !units.some((unit) => unit.id === unitId)) {
			markError('Satuan wajib dipilih.');
			return false;
		}

		const duplicateSku = products.some(
			(product) =>
				product.id !== productId &&
				product.sku.trim().toUpperCase() === cleanedSku,
		);

		if (duplicateSku) {
			markError('SKU sudah terpakai. Gunakan SKU lain.');
			return false;
		}

		setProducts((current) =>
			current.map((product) =>
				product.id === productId
					? {
							...product,
							name: cleanedName,
							sku: cleanedSku,
							categoryId,
							unitId,
						}
					: product,
			),
		);

		markSuccess('Produk berhasil diperbarui.');
		return true;
	};

	const handleDeleteProduct = (productId: string): boolean => {
		const target = products.find((product) => product.id === productId);

		if (!target) {
			markError('Produk tidak ditemukan.');
			return false;
		}

		setProducts((current) =>
			current.filter((product) => product.id !== productId),
		);
		setOutletStocks((current) =>
			current.filter((record) => record.productId !== productId),
		);

		setFavoritesByLocation((current) => {
			const next: FavoriteState = { ...current };
			for (const key of Object.keys(next) as LocationKey[]) {
				next[key] = (next[key] ?? []).filter((id) => id !== productId);
			}
			return next;
		});

		setUsageByLocation((current) => {
			const next: UsageState = { ...current };
			for (const key of Object.keys(next) as LocationKey[]) {
				const usage = { ...(next[key] ?? {}) };
				delete usage[productId];
				next[key] = usage;
			}
			return next;
		});

		markSuccess('Produk berhasil dihapus.');
		return true;
	};

	const handleCreateOutlet = ({
		name,
		code,
		address,
		latitude,
		longitude,
	}: {
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}): boolean => {
		const cleanedName = name.trim();
		const cleanedCode = code.trim().toUpperCase();
		const cleanedAddress = address.trim();

		if (!cleanedName || !cleanedCode || !cleanedAddress) {
			markError('Nama outlet, kode outlet, dan alamat wajib diisi.');
			return false;
		}

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			markError('Koordinat outlet tidak valid.');
			return false;
		}

		const duplicate = outlets.some(
			(outlet) => outlet.code.trim().toUpperCase() === cleanedCode,
		);

		if (duplicate) {
			markError('Kode outlet sudah terpakai.');
			return false;
		}

		setOutlets((current) => [
			...current,
			{
				id: createId(),
				name: cleanedName,
				code: cleanedCode,
				address: cleanedAddress,
				latitude,
				longitude,
			},
		]);

		markSuccess('Outlet berhasil ditambahkan.');
		return true;
	};

	const handleUpdateOutlet = ({
		outletId,
		name,
		code,
		address,
		latitude,
		longitude,
	}: {
		outletId: string;
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}): boolean => {
		const cleanedName = name.trim();
		const cleanedCode = code.trim().toUpperCase();
		const cleanedAddress = address.trim();

		if (!outlets.some((outlet) => outlet.id === outletId)) {
			markError('Outlet tidak ditemukan.');
			return false;
		}

		if (!cleanedName || !cleanedCode || !cleanedAddress) {
			markError('Nama outlet, kode outlet, dan alamat wajib diisi.');
			return false;
		}

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			markError('Koordinat outlet tidak valid.');
			return false;
		}

		const duplicate = outlets.some(
			(outlet) =>
				outlet.id !== outletId &&
				outlet.code.trim().toUpperCase() === cleanedCode,
		);

		if (duplicate) {
			markError('Kode outlet sudah terpakai.');
			return false;
		}

		setOutlets((current) =>
			current.map((outlet) =>
				outlet.id === outletId
					? {
							...outlet,
							name: cleanedName,
							code: cleanedCode,
							address: cleanedAddress,
							latitude,
							longitude,
						}
					: outlet,
			),
		);

		markSuccess('Outlet berhasil diperbarui.');
		return true;
	};

	const handleDeleteOutlet = (outletId: string): boolean => {
		const target = outlets.find((outlet) => outlet.id === outletId);

		if (!target) {
			markError('Outlet tidak ditemukan.');
			return false;
		}

		const usedInMovement = movements.some(
			(movement) =>
				movement.locationKind === 'outlet' && movement.locationId === outletId,
		);

		if (usedInMovement) {
			markError(
				'Outlet tidak bisa dihapus karena sudah dipakai pada riwayat pergerakan.',
			);
			return false;
		}

		const usedInTransfer = transfers.some(
			(transfer) =>
				transfer.sourceOutletId === outletId ||
				transfer.destinations.some(
					(destination) => destination.outletId === outletId,
				),
		);

		if (usedInTransfer) {
			markError(
				'Outlet tidak bisa dihapus karena sudah dipakai pada riwayat transfer.',
			);
			return false;
		}

		const hasStock = outletStocks.some(
			(record) => record.outletId === outletId && record.qty > 0,
		);

		if (hasStock) {
			markError('Outlet tidak bisa dihapus karena masih memiliki stok produk.');
			return false;
		}

		setOutlets((current) => current.filter((outlet) => outlet.id !== outletId));
		setOutletStocks((current) =>
			current.filter((record) => record.outletId !== outletId),
		);

		setFavoritesByLocation((current) => {
			const key = `outlet:${outletId}` as LocationKey;
			const next = { ...current };
			delete next[key];
			return next;
		});

		setUsageByLocation((current) => {
			const key = `outlet:${outletId}` as LocationKey;
			const next = { ...current };
			delete next[key];
			return next;
		});

		markSuccess('Outlet berhasil dihapus.');
		return true;
	};

	const handleTransferProduct = ({
		productId,
		source,
		destinations,
		note,
	}: {
		productId: string;
		source: StockLocation;
		destinations: Array<{ outletId: string; qty: number }>;
		note: string;
	}): boolean => {
		const product = products.find((item) => item.id === productId);

		if (!product) {
			markError('Produk transfer tidak ditemukan.');
			return false;
		}

		if (source.kind === 'outlet' && !source.outletId) {
			markError('Outlet sumber harus dipilih.');
			return false;
		}

		if (
			source.kind === 'outlet' &&
			!outlets.some((outlet) => outlet.id === source.outletId)
		) {
			markError('Outlet sumber tidak ditemukan.');
			return false;
		}

		const cleanedDestinations = destinations
			.map((destination) => ({
				outletId: destination.outletId,
				qty: Number(destination.qty),
			}))
			.filter((destination) => destination.outletId);

		if (cleanedDestinations.length === 0) {
			markError('Pilih minimal satu outlet tujuan transfer.');
			return false;
		}

		if (
			cleanedDestinations.some(
				(destination) =>
					!Number.isInteger(destination.qty) || destination.qty <= 0,
			)
		) {
			markError(
				'Jumlah transfer per outlet harus bilangan bulat lebih dari 0.',
			);
			return false;
		}

		const destinationIds = cleanedDestinations.map(
			(destination) => destination.outletId,
		);
		const uniqueDestinationCount = new Set(destinationIds).size;

		if (uniqueDestinationCount !== destinationIds.length) {
			markError('Outlet tujuan transfer tidak boleh duplikat.');
			return false;
		}

		if (
			source.kind === 'outlet' &&
			cleanedDestinations.some(
				(destination) => destination.outletId === source.outletId,
			)
		) {
			markError('Outlet tujuan tidak boleh sama dengan outlet sumber.');
			return false;
		}

		const missingOutlet = cleanedDestinations.some(
			(destination) =>
				!outlets.some((outlet) => outlet.id === destination.outletId),
		);

		if (missingOutlet) {
			markError('Ada outlet tujuan yang tidak ditemukan.');
			return false;
		}

		const totalQty = cleanedDestinations.reduce(
			(sum, destination) => sum + destination.qty,
			0,
		);
		const sourceStock = getStockByLocation(productId, source);

		if (totalQty > sourceStock) {
			markError('Transfer gagal. Total jumlah transfer melebihi stok sumber.');
			return false;
		}

		if (source.kind === 'central') {
			setProducts((current) =>
				current.map((item) =>
					item.id === productId
						? { ...item, stock: item.stock - totalQty }
						: item,
				),
			);

			setOutletStocks((current) => {
				let next = current;

				for (const destination of cleanedDestinations) {
					const currentQty = getOutletStock(
						next,
						destination.outletId,
						productId,
					);
					next = upsertOutletStock(
						next,
						destination.outletId,
						productId,
						currentQty + destination.qty,
					);
				}

				return next;
			});
		} else if (source.outletId) {
			setOutletStocks((current) => {
				let next = current;

				const sourceCurrentQty = getOutletStock(
					next,
					source.outletId!,
					productId,
				);
				next = upsertOutletStock(
					next,
					source.outletId!,
					productId,
					sourceCurrentQty - totalQty,
				);

				for (const destination of cleanedDestinations) {
					const currentQty = getOutletStock(
						next,
						destination.outletId,
						productId,
					);
					next = upsertOutletStock(
						next,
						destination.outletId,
						productId,
						currentQty + destination.qty,
					);
				}

				return next;
			});
		}

		const destinationsSnapshot = cleanedDestinations.map((destination) => {
			const outlet = outlets.find((item) => item.id === destination.outletId)!;
			return {
				outletId: outlet.id,
				outletName: outlet.name,
				qty: destination.qty,
			};
		});

		const transferRecord: TransferRecord = {
			id: createId(),
			productId,
			productName: product.name,
			sourceKind: source.kind,
			sourceOutletId: source.outletId,
			sourceLabel: getLocationLabel(outlets, source),
			destinations: destinationsSnapshot,
			totalQty,
			note: note.trim() || 'Transfer stok',
			createdAt: new Date().toISOString(),
		};

		setTransfers((current) => [transferRecord, ...current]);
		openMore('transfer');
		markSuccess('Transfer produk berhasil disimpan.');

		return true;
	};

	return (
		<main
			className={`min-h-screen pb-28 sm:pb-10 ${activeToneStyle.pageBackground}`}
		>
			{toast ? (
				<ToastMessage tone={toast.tone} message={toast.message} />
			) : null}

			<section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
				<TopBarProfile
					tone={activeTone}
					headerClass={activeToneStyle.header}
					eventPulse={eventPulse}
					isOpen={isProfileMenuOpen}
					menuRef={profileMenuRef}
					onToggle={() => setIsProfileMenuOpen((current) => !current)}
					onProfileClick={handleProfileClick}
					onLogoutClick={handleLogoutClick}
				/>

				<DesktopTabs
					activeTab={activeTab}
					tone={activeTone}
					onChange={handleMainTabChange}
				/>

				{error ? (
					<p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{error}
					</p>
				) : null}

				<div
					key={`${activeTab}-${activeMoreTab}-${activeMasterTab}`}
					className="panel-enter"
				>
					{activeTab === 'dashboard' ? (
						<Dashboard
							totalProducts={products.length}
							totalOutlets={outlets.length}
							totalStok={totalStok}
							totalStokPusat={totalStokPusat}
							totalStokOutlet={totalStokOutlet}
							lowStockCount={lowStockCount}
							totalStockIn={totalStockIn}
							totalStockOut={totalStockOut}
							opnameEvents={opnameEvents}
							products={products}
							categoryNameById={categoryNameById}
							unitNameById={unitNameById}
						/>
					) : null}

					{activeTab === 'in' ? (
						<MovementForm
							mode="in"
							products={products}
							categories={categories}
							unitNameById={unitNameById}
							outlets={outlets}
							favoritesByLocation={favoritesByLocation}
							usageByLocation={usageByLocation}
							getStockByLocation={getStockByLocation}
							onToggleFavorite={toggleFavoriteProduct}
							onSubmit={handleStockMovement}
						/>
					) : null}

					{activeTab === 'out' ? (
						<MovementForm
							mode="out"
							products={products}
							categories={categories}
							unitNameById={unitNameById}
							outlets={outlets}
							favoritesByLocation={favoritesByLocation}
							usageByLocation={usageByLocation}
							getStockByLocation={getStockByLocation}
							onToggleFavorite={toggleFavoriteProduct}
							onSubmit={handleStockMovement}
						/>
					) : null}

					{activeTab === 'more' ? (
						<MoreContent
							activeTab={activeMoreTab}
							tone={activeTone}
							onChangeTab={setActiveMoreTab}
							onOpenMenu={openMoreDialog}
							movements={pagedMovements}
							movementTotal={filteredMovements.length}
							movementPage={Math.min(historyPage, historyTotalPages)}
							movementPageSize={historyPageSize}
							movementTotalPages={historyTotalPages}
							historyFilter={historyFilter}
							activeMasterTab={activeMasterTab}
							onChangeHistoryFilter={setHistoryFilter}
							onChangeMasterTab={setActiveMasterTab}
							onChangeMovementPage={setHistoryPage}
							onChangeMovementPageSize={setHistoryPageSize}
							products={products}
							categories={categories}
							units={units}
							categoryNameById={categoryNameById}
							unitNameById={unitNameById}
							productPage={productPage}
							productPageSize={productPageSize}
							onChangeProductPage={setProductPage}
							onChangeProductPageSize={(size) => {
								setProductPageSize(size);
								setProductPage(1);
							}}
							onCreateProduct={handleCreateProduct}
							onUpdateProduct={handleUpdateProduct}
							onDeleteProduct={handleDeleteProduct}
							onCreateCategory={handleCreateCategory}
							onUpdateCategory={handleUpdateCategory}
							onDeleteCategory={handleDeleteCategory}
							onCreateUnit={handleCreateUnit}
							onUpdateUnit={handleUpdateUnit}
							onDeleteUnit={handleDeleteUnit}
							outlets={outlets}
							outletStocks={outletStocks}
							transfers={pagedTransfers}
							transferTotal={transfers.length}
							transferPage={Math.min(transferPage, transferTotalPages)}
							transferPageSize={transferPageSize}
							transferTotalPages={transferTotalPages}
							onChangeTransferPage={setTransferPage}
							onChangeTransferPageSize={setTransferPageSize}
							onCreateOutlet={handleCreateOutlet}
							onUpdateOutlet={handleUpdateOutlet}
							onDeleteOutlet={handleDeleteOutlet}
							onSubmitTransfer={handleTransferProduct}
							onSubmitOpname={handleOpname}
							onNotifySuccess={markSuccess}
							onNotifyError={markError}
							favoritesByLocation={favoritesByLocation}
							usageByLocation={usageByLocation}
							getStockByLocation={getStockByLocation}
							onToggleFavorite={toggleFavoriteProduct}
						/>
					) : null}
				</div>
			</section>

			<BottomNav
				activeTab={activeTab}
				tone={activeTone}
				onChange={handleMainTabChange}
				onOpenMoreMenu={openMoreDialog}
			/>

			<MoreMenuDialog
				isOpen={isMoreMenuOpen}
				activeTab={activeMoreTab}
				tone={activeTone}
				showActive={activeTab === 'more'}
				onClose={() => setIsMoreMenuOpen(false)}
				onSelect={selectMoreDialogItem}
			/>
		</main>
	);
}

function TopBarProfile({
	tone,
	headerClass,
	eventPulse,
	isOpen,
	menuRef,
	onToggle,
	onProfileClick,
	onLogoutClick,
}: {
	tone: PageTone;
	headerClass: string;
	eventPulse: boolean;
	isOpen: boolean;
	menuRef: { current: HTMLDivElement | null };
	onToggle: () => void;
	onProfileClick: () => void;
	onLogoutClick: () => void;
}) {
	const labelTone = tone === 'orange' ? 'text-orange-100' : 'text-white/75';
	const badgeTone =
		tone === 'orange'
			? 'bg-white/20 text-white ring-1 ring-white/35'
			: 'bg-white/15 text-white ring-1 ring-white/30';

	return (
		<header
			className={`sticky top-3 z-40 mb-6 rounded-2xl p-3 text-white sm:mb-8 sm:p-4 ${headerClass} ${
				eventPulse ? 'event-pulse' : ''
			}`}
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className={`text-[11px] uppercase tracking-[0.18em] ${labelTone}`}>
						TOGA | Stock Manager
					</p>
					<h1 className="mt-0.5 text-lg font-semibold sm:text-xl">
						Inventory Control Center
					</h1>
				</div>

				<div className="relative" ref={menuRef}>
					<button
						type="button"
						onClick={onToggle}
						aria-expanded={isOpen}
						aria-haspopup="menu"
						className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2 text-left transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
					>
						<span
							className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${badgeTone}`}
						>
							AG
						</span>
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold leading-tight">
								Admin Gudang
							</span>
							<span className={`block text-[11px] leading-tight ${labelTone}`}>
								Supervisor
							</span>
						</span>
						<span className={`text-xs ${labelTone}`}>{isOpen ? '▲' : '▼'}</span>
					</button>

					{isOpen ? (
						<div
							role="menu"
							className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
						>
							<button
								type="button"
								role="menuitem"
								onClick={onProfileClick}
								className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
							>
								Profil
							</button>
							<button
								type="button"
								role="menuitem"
								onClick={onLogoutClick}
								className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
							>
								Logout
							</button>
						</div>
					) : null}
				</div>
			</div>
		</header>
	);
}

function DesktopTabs({
	activeTab,
	tone,
	onChange,
}: {
	activeTab: TabKey;
	tone: PageTone;
	onChange: (tab: TabKey) => void;
}) {
	const tabs: { key: TabKey; label: string }[] = [
		{ key: 'dashboard', label: 'Dasbor' },
		{ key: 'in', label: 'Stok Masuk' },
		{ key: 'out', label: 'Stok Keluar' },
		{ key: 'more', label: 'Lainnya' },
	];

	return (
		<div className="mb-5 hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:block">
			<div className="grid grid-cols-4 gap-2">
				{tabs.map((tab) => (
					<button
						key={tab.key}
						type="button"
						onClick={() => onChange(tab.key)}
						className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
							activeTab === tab.key
								? PAGE_TONE_STYLES[tone].tabActive
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200'
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>
		</div>
	);
}

function Dashboard({
	totalProducts,
	totalOutlets,
	totalStok,
	totalStokPusat,
	totalStokOutlet,
	lowStockCount,
	totalStockIn,
	totalStockOut,
	opnameEvents,
	products,
	categoryNameById,
	unitNameById,
}: {
	totalProducts: number;
	totalOutlets: number;
	totalStok: number;
	totalStokPusat: number;
	totalStokOutlet: number;
	lowStockCount: number;
	totalStockIn: number;
	totalStockOut: number;
	opnameEvents: number;
	products: Product[];
	categoryNameById: Record<string, string>;
	unitNameById: Record<string, string>;
}) {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
				<StatCard label="Jumlah Produk" value={totalProducts} />
				<StatCard label="Jumlah Outlet" value={totalOutlets} />
				<StatCard label="Stok Total" value={totalStok} />
				<StatCard label="Total Masuk" value={totalStockIn} />
				<StatCard label="Total Keluar" value={totalStockOut} />
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
					<h2 className="text-lg font-semibold text-slate-900">
						Ringkasan Stok
					</h2>
					<ul className="mt-3 space-y-2 text-sm text-slate-600">
						<li>Stok pusat: {totalStokPusat} unit</li>
						<li>Stok outlet: {totalStokOutlet} unit</li>
						<li>Produk stok rendah (pusat): {lowStockCount} produk</li>
						<li>Jumlah opname: {opnameEvents} kejadian</li>
					</ul>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
					<h2 className="text-lg font-semibold text-slate-900">
						Stok Produk di Pusat
					</h2>

					{products.length === 0 ? (
						<p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-500">
							Belum ada produk. Tambahkan dari menu Produk.
						</p>
					) : (
						<ul className="mt-4 space-y-2">
							{products.map((product) => (
								<li
									key={product.id}
									className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
								>
									<div>
										<p className="text-sm font-medium text-slate-900">
											{product.name}
										</p>
										<p className="text-xs text-slate-500">
											{product.sku} |{' '}
											{categoryNameById[product.categoryId] ?? '-'}
										</p>
									</div>
									<span
										className={`rounded-full px-2 py-1 text-xs font-semibold ${
											product.stock <= 10
												? 'bg-red-100 text-red-700'
												: 'bg-emerald-100 text-emerald-700'
										}`}
									>
										{product.stock} {getProductUnitLabel(product, unitNameById)}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
			<p
				className={`mt-2 font-bold text-slate-900 ${typeof value === 'number' ? 'text-2xl' : 'text-sm'}`}
			>
				{value}
			</p>
		</article>
	);
}

function MovementForm({
	products,
	categories,
	unitNameById,
	outlets,
	favoritesByLocation,
	usageByLocation,
	mode,
	getStockByLocation,
	onToggleFavorite,
	onSubmit,
}: {
	products: Product[];
	categories: Category[];
	unitNameById: Record<string, string>;
	outlets: Outlet[];
	favoritesByLocation: FavoriteState;
	usageByLocation: UsageState;
	mode: 'in' | 'out';
	getStockByLocation: (productId: string, location: StockLocation) => number;
	onToggleFavorite: (location: StockLocation, productId: string) => void;
	onSubmit: (payload: {
		productId: string;
		qty: number;
		type: 'in' | 'out';
		note: string;
		location: StockLocation;
	}) => boolean;
}) {
	const [locationValue, setLocationValue] = useState('central');
	const [productId, setProductId] = useState(products[0]?.id ?? '');
	const [isInputModalOpen, setIsInputModalOpen] = useState(false);
	const [eventLines, setEventLines] = useState<string[] | null>(null);
	const locationOptions = useMemo(() => {
		const base = [
			{
				value: 'central',
				label: 'Pusat',
				description: 'Gudang pusat',
			},
		];

		if (mode === 'in') {
			return base;
		}

		return [
			...base,
			...outlets.map((outlet) => ({
				value: `outlet:${outlet.id}`,
				label: `${outlet.name} (${outlet.code})`,
				description: outlet.address,
			})),
		];
	}, [mode, outlets]);

	const location: StockLocation =
		mode === 'in'
			? { kind: 'central' }
			: locationValue === 'central'
				? { kind: 'central' }
				: { kind: 'outlet', outletId: locationValue.replace('outlet:', '') };

	const locationKey = toLocationKey(location);
	const prioritizedProducts = useMemo(
		() =>
			prioritizeProducts(
				products,
				locationKey,
				favoritesByLocation,
				usageByLocation,
			),
		[products, locationKey, favoritesByLocation, usageByLocation],
	);
	const favoriteSet = new Set(favoritesByLocation[locationKey] ?? []);

	const selectedProduct = prioritizedProducts.find(
		(product) => product.id === productId,
	);
	const selectedUnitLabel = selectedProduct
		? getProductUnitLabel(selectedProduct, unitNameById)
		: '-';

	useEffect(() => {
		if (prioritizedProducts.length === 0) {
			setProductId('');
			return;
		}

		if (!prioritizedProducts.some((product) => product.id === productId)) {
			setProductId(prioritizedProducts[0].id);
		}
	}, [productId, prioritizedProducts]);

	useEffect(() => {
		if (!locationOptions.some((option) => option.value === locationValue)) {
			setLocationValue('central');
		}
	}, [locationOptions, locationValue]);

	const availableStock = selectedProduct
		? getStockByLocation(selectedProduct.id, location)
		: 0;
	const locationLabel = getLocationLabel(outlets, location);
	const selectedUsage = selectedProduct
		? (usageByLocation[locationKey]?.[selectedProduct.id] ?? 0)
		: 0;
	const isSelectedFavorite = selectedProduct
		? favoriteSet.has(selectedProduct.id)
		: false;

	if (products.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">
					{mode === 'in' ? 'Modul Stok Masuk' : 'Modul Stok Keluar'}
				</h2>
				<p className="mt-2 text-sm text-slate-500">
					Belum ada produk. Tambahkan dari menu Produk.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">
					{mode === 'in' ? 'Transaksi Stok Masuk' : 'Transaksi Stok Keluar'}
				</h2>
				<p className="mt-1 text-sm text-slate-500">
					{mode === 'in'
						? 'Stok masuk hanya untuk lokasi pusat.'
						: 'Stok keluar bisa diproses dari pusat atau outlet.'}
				</p>

				<div className="mt-4 space-y-3">
					<LocationSelectDropdown
						label="Lokasi"
						options={locationOptions}
						value={locationValue}
						onChange={setLocationValue}
					/>

					<ProductSelectDropdown
						label="Produk"
						products={prioritizedProducts}
						categories={categories}
						value={productId}
						onChange={setProductId}
						favoriteIds={favoritesByLocation[locationKey] ?? []}
						usageMap={usageByLocation[locationKey] ?? {}}
						onToggleFavorite={(targetProductId) =>
							onToggleFavorite(location, targetProductId)
						}
					/>

					{selectedProduct ? (
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
							<p className="text-xs text-slate-600">
								Dipakai {selectedUsage}x pada lokasi ini.
							</p>
							<button
								type="button"
								onClick={() => onToggleFavorite(location, selectedProduct.id)}
								className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
									isSelectedFavorite
										? 'bg-amber-100 text-amber-700'
										: 'bg-slate-200 text-slate-700'
								}`}
							>
								{isSelectedFavorite
									? 'Favorit lokasi'
									: 'Jadikan favorit lokasi'}
							</button>
						</div>
					) : null}

					<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
						<p className="text-[11px] uppercase tracking-wide text-slate-500">
							Stok Tersedia
						</p>
						<p className="text-lg font-bold text-slate-900">
							{availableStock} {selectedUnitLabel}
						</p>
					</div>

					<button
						type="button"
						onClick={() => setIsInputModalOpen(true)}
						disabled={!selectedProduct}
						className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
							mode === 'in'
								? 'bg-teal-600 hover:bg-teal-700'
								: 'bg-rose-600 hover:bg-rose-700'
						} disabled:cursor-not-allowed disabled:opacity-50`}
					>
						Lanjut Input {mode === 'in' ? 'Stok Masuk' : 'Stok Keluar'}
					</button>
				</div>
			</div>

			<MovementInputModal
				isOpen={isInputModalOpen}
				mode={mode}
				product={selectedProduct ?? null}
				locationLabel={locationLabel}
				currentStock={availableStock}
				unitLabel={selectedUnitLabel}
				onClose={() => setIsInputModalOpen(false)}
				onSave={({ qty, note, projectedStock }) => {
					if (!selectedProduct) {
						return;
					}

					const success = onSubmit({
						productId: selectedProduct.id,
						qty,
						type: mode,
						note,
						location,
					});

					if (success) {
						setIsInputModalOpen(false);
						setEventLines([
							`Lokasi: ${locationLabel}`,
							`Produk: ${selectedProduct.name}`,
							`Jumlah: ${qty} ${selectedUnitLabel}`,
							`Stok akhir: ${projectedStock} ${selectedUnitLabel}`,
							`Catatan: ${note || 'Tanpa catatan'}`,
						]);
					}
				}}
			/>

			<EventResultModal
				isOpen={eventLines !== null}
				title={mode === 'in' ? 'Stok Masuk Berhasil' : 'Stok Keluar Berhasil'}
				tone={mode === 'in' ? 'teal' : 'red'}
				lines={eventLines ?? []}
				onClose={() => setEventLines(null)}
			/>
		</>
	);
}

function MoreContent({
	activeTab,
	activeMasterTab,
	tone,
	onChangeTab,
	onChangeMasterTab,
	onOpenMenu,
	movements,
	movementTotal,
	movementPage,
	movementPageSize,
	movementTotalPages,
	historyFilter,
	onChangeHistoryFilter,
	onChangeMovementPage,
	onChangeMovementPageSize,
	products,
	categories,
	units,
	categoryNameById,
	unitNameById,
	productPage,
	productPageSize,
	onChangeProductPage,
	onChangeProductPageSize,
	onCreateProduct,
	onUpdateProduct,
	onDeleteProduct,
	onCreateCategory,
	onUpdateCategory,
	onDeleteCategory,
	onCreateUnit,
	onUpdateUnit,
	onDeleteUnit,
	outlets,
	outletStocks,
	transfers,
	transferTotal,
	transferPage,
	transferPageSize,
	transferTotalPages,
	onChangeTransferPage,
	onChangeTransferPageSize,
	onCreateOutlet,
	onUpdateOutlet,
	onDeleteOutlet,
	onSubmitTransfer,
	onSubmitOpname,
	onNotifySuccess,
	onNotifyError,
	favoritesByLocation,
	usageByLocation,
	getStockByLocation,
	onToggleFavorite,
}: {
	activeTab: MoreTab;
	activeMasterTab: MasterTab;
	tone: PageTone;
	onChangeTab: (tab: MoreTab) => void;
	onChangeMasterTab: (tab: MasterTab) => void;
	onOpenMenu: () => void;
	movements: Movement[];
	movementTotal: number;
	movementPage: number;
	movementPageSize: PageSize;
	movementTotalPages: number;
	historyFilter: HistoryFilter;
	onChangeHistoryFilter: (filter: HistoryFilter) => void;
	onChangeMovementPage: (page: number) => void;
	onChangeMovementPageSize: (size: PageSize) => void;
	products: Product[];
	categories: Category[];
	units: Unit[];
	categoryNameById: Record<string, string>;
	unitNameById: Record<string, string>;
	productPage: number;
	productPageSize: PageSize;
	onChangeProductPage: (page: number) => void;
	onChangeProductPageSize: (size: PageSize) => void;
	onCreateProduct: (payload: {
		name: string;
		sku: string;
		initialStock: number;
		categoryId: string;
		unitId: string;
	}) => boolean;
	onUpdateProduct: (payload: {
		productId: string;
		name: string;
		sku: string;
		categoryId: string;
		unitId: string;
	}) => boolean;
	onDeleteProduct: (productId: string) => boolean;
	onCreateCategory: (payload: { name: string }) => boolean;
	onUpdateCategory: (payload: { categoryId: string; name: string }) => boolean;
	onDeleteCategory: (categoryId: string) => boolean;
	onCreateUnit: (payload: { name: string }) => boolean;
	onUpdateUnit: (payload: { unitId: string; name: string }) => boolean;
	onDeleteUnit: (unitId: string) => boolean;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	transfers: TransferRecord[];
	transferTotal: number;
	transferPage: number;
	transferPageSize: PageSize;
	transferTotalPages: number;
	onChangeTransferPage: (page: number) => void;
	onChangeTransferPageSize: (size: PageSize) => void;
	onCreateOutlet: (payload: {
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => boolean;
	onUpdateOutlet: (payload: {
		outletId: string;
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => boolean;
	onDeleteOutlet: (outletId: string) => boolean;
	onSubmitTransfer: (payload: {
		productId: string;
		source: StockLocation;
		destinations: Array<{ outletId: string; qty: number }>;
		note: string;
	}) => boolean;
	onSubmitOpname: (payload: {
		productId: string;
		actualStock: number;
		note: string;
		location: StockLocation;
	}) => boolean;
	onNotifySuccess: (message: string) => void;
	onNotifyError: (message: string) => void;
	favoritesByLocation: FavoriteState;
	usageByLocation: UsageState;
	getStockByLocation: (productId: string, location: StockLocation) => number;
	onToggleFavorite: (location: StockLocation, productId: string) => void;
}) {
	const tabs: { key: MoreTab; label: string }[] = [
		{ key: 'history', label: 'Riwayat' },
		{ key: 'master', label: 'Master' },
		{ key: 'outlets', label: 'Outlet' },
		{ key: 'transfer', label: 'Transfer' },
		{ key: 'opname', label: 'Opname' },
		{ key: 'analytics', label: 'Analitik' },
		{ key: 'export', label: 'Ekspor' },
	];

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
				<div className="flex items-center justify-between gap-2">
					<p className="text-xs uppercase tracking-wide text-slate-500">
						Modul Lainnya
					</p>
					<button
						type="button"
						onClick={onOpenMenu}
						className={`rounded-full px-3 py-1 text-xs font-semibold sm:hidden ${PAGE_TONE_STYLES[tone].solidButton} ${PAGE_TONE_STYLES[tone].solidButtonHover}`}
					>
						Ganti Modul
					</button>
				</div>

				<div className="mt-2 hidden flex-wrap gap-2 sm:flex">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => onChangeTab(tab.key)}
							className={`rounded-xl px-3 py-2 text-sm font-semibold ${
								activeTab === tab.key
									? PAGE_TONE_STYLES[tone].tabActive
									: 'bg-slate-100 text-slate-600'
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				<p className="mt-2 text-sm font-medium text-slate-700 sm:hidden">
					Modul aktif: {tabs.find((tab) => tab.key === activeTab)?.label}
				</p>
			</div>

			{activeTab === 'history' ? (
				<History
					movements={movements}
					products={products}
					unitNameById={unitNameById}
					totalItems={movementTotal}
					page={movementPage}
					pageSize={movementPageSize}
					totalPages={movementTotalPages}
					filter={historyFilter}
					onChangeFilter={onChangeHistoryFilter}
					onChangePage={onChangeMovementPage}
					onChangePageSize={onChangeMovementPageSize}
				/>
			) : null}

			{activeTab === 'master' ? (
				<MasterModule
					activeTab={activeMasterTab}
					onChangeTab={onChangeMasterTab}
					products={products}
					categories={categories}
					units={units}
					categoryNameById={categoryNameById}
					unitNameById={unitNameById}
					productPage={productPage}
					productPageSize={productPageSize}
					onChangeProductPage={onChangeProductPage}
					onChangeProductPageSize={onChangeProductPageSize}
					onCreateProduct={onCreateProduct}
					onUpdateProduct={onUpdateProduct}
					onDeleteProduct={onDeleteProduct}
					onCreateCategory={onCreateCategory}
					onUpdateCategory={onUpdateCategory}
					onDeleteCategory={onDeleteCategory}
					onCreateUnit={onCreateUnit}
					onUpdateUnit={onUpdateUnit}
					onDeleteUnit={onDeleteUnit}
				/>
			) : null}

			{activeTab === 'outlets' ? (
				<OutletManager
					outlets={outlets}
					outletStocks={outletStocks}
					products={products}
					onCreate={onCreateOutlet}
					onUpdate={onUpdateOutlet}
					onDelete={onDeleteOutlet}
				/>
			) : null}

			{activeTab === 'transfer' ? (
				<TransferModule
					products={products}
					unitNameById={unitNameById}
					outlets={outlets}
					transfers={transfers}
					totalTransferItems={transferTotal}
					transferPage={transferPage}
					transferPageSize={transferPageSize}
					transferTotalPages={transferTotalPages}
					getStockByLocation={getStockByLocation}
					onSubmit={onSubmitTransfer}
					onChangePage={onChangeTransferPage}
					onChangePageSize={onChangeTransferPageSize}
				/>
			) : null}

			{activeTab === 'opname' ? (
				<StockOpnameForm
					products={products}
					categories={categories}
					unitNameById={unitNameById}
					outlets={outlets}
					favoritesByLocation={favoritesByLocation}
					usageByLocation={usageByLocation}
					getStockByLocation={getStockByLocation}
					onToggleFavorite={onToggleFavorite}
					onSubmit={onSubmitOpname}
				/>
			) : null}

			{activeTab === 'analytics' ? (
				<StockAnalyticsModule
					products={products}
					categories={categories}
					unitNameById={unitNameById}
					categoryNameById={categoryNameById}
					outlets={outlets}
					outletStocks={outletStocks}
					movements={movements}
				/>
			) : null}

			{activeTab === 'export' ? (
				<ExportStockModule
					products={products}
					unitNameById={unitNameById}
					categoryNameById={categoryNameById}
					outlets={outlets}
					outletStocks={outletStocks}
					onSuccess={onNotifySuccess}
					onError={onNotifyError}
				/>
			) : null}
		</div>
	);
}

function MasterModule({
	activeTab,
	onChangeTab,
	products,
	categories,
	units,
	categoryNameById,
	unitNameById,
	productPage,
	productPageSize,
	onChangeProductPage,
	onChangeProductPageSize,
	onCreateProduct,
	onUpdateProduct,
	onDeleteProduct,
	onCreateCategory,
	onUpdateCategory,
	onDeleteCategory,
	onCreateUnit,
	onUpdateUnit,
	onDeleteUnit,
}: {
	activeTab: MasterTab;
	onChangeTab: (tab: MasterTab) => void;
	products: Product[];
	categories: Category[];
	units: Unit[];
	categoryNameById: Record<string, string>;
	unitNameById: Record<string, string>;
	productPage: number;
	productPageSize: PageSize;
	onChangeProductPage: (page: number) => void;
	onChangeProductPageSize: (size: PageSize) => void;
	onCreateProduct: (payload: {
		name: string;
		sku: string;
		initialStock: number;
		categoryId: string;
		unitId: string;
	}) => boolean;
	onUpdateProduct: (payload: {
		productId: string;
		name: string;
		sku: string;
		categoryId: string;
		unitId: string;
	}) => boolean;
	onDeleteProduct: (productId: string) => boolean;
	onCreateCategory: (payload: { name: string }) => boolean;
	onUpdateCategory: (payload: { categoryId: string; name: string }) => boolean;
	onDeleteCategory: (categoryId: string) => boolean;
	onCreateUnit: (payload: { name: string }) => boolean;
	onUpdateUnit: (payload: { unitId: string; name: string }) => boolean;
	onDeleteUnit: (unitId: string) => boolean;
}) {
	const tabs: { key: MasterTab; label: string }[] = [
		{ key: 'products', label: 'Produk' },
		{ key: 'categories', label: 'Kategori' },
		{ key: 'units', label: 'Satuan' },
	];

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
				<p className="text-xs uppercase tracking-wide text-slate-500">
					Master Data
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => onChangeTab(tab.key)}
							className={`rounded-xl px-3 py-2 text-sm font-semibold ${
								activeTab === tab.key
									? 'bg-slate-900 text-white'
									: 'bg-slate-100 text-slate-600'
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{activeTab === 'products' ? (
				<ManageProducts
					products={products}
					categories={categories}
					units={units}
					categoryNameById={categoryNameById}
					unitNameById={unitNameById}
					page={productPage}
					pageSize={productPageSize}
					onChangePage={onChangeProductPage}
					onChangePageSize={onChangeProductPageSize}
					onCreate={onCreateProduct}
					onUpdate={onUpdateProduct}
					onDelete={onDeleteProduct}
				/>
			) : null}

			{activeTab === 'categories' ? (
				<CategoryManager
					categories={categories}
					products={products}
					onCreate={onCreateCategory}
					onUpdate={onUpdateCategory}
					onDelete={onDeleteCategory}
				/>
			) : null}

			{activeTab === 'units' ? (
				<UnitManager
					units={units}
					products={products}
					onCreate={onCreateUnit}
					onUpdate={onUpdateUnit}
					onDelete={onDeleteUnit}
				/>
			) : null}
		</div>
	);
}

function History({
	movements,
	products,
	unitNameById,
	totalItems,
	page,
	pageSize,
	totalPages,
	filter,
	onChangeFilter,
	onChangePage,
	onChangePageSize,
}: {
	movements: Movement[];
	products: Product[];
	unitNameById: Record<string, string>;
	totalItems: number;
	page: number;
	pageSize: PageSize;
	totalPages: number;
	filter: HistoryFilter;
	onChangeFilter: (filter: HistoryFilter) => void;
	onChangePage: (page: number) => void;
	onChangePageSize: (size: PageSize) => void;
}) {
	const filters: { key: HistoryFilter; label: string }[] = [
		{ key: 'all', label: 'Semua' },
		{ key: 'in', label: 'Masuk' },
		{ key: 'out', label: 'Keluar' },
		{ key: 'opname', label: 'Opname' },
	];

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
			<h2 className="text-lg font-semibold text-slate-900">
				Riwayat Pergerakan Stok
			</h2>
			<p className="mt-1 text-sm text-slate-500">
				Filter berdasarkan tipe transaksi dan pantau lokasi sumber transaksinya.
			</p>

			<div className="mt-4 flex flex-wrap gap-2">
				{filters.map((item) => (
					<button
						key={item.key}
						type="button"
						onClick={() => onChangeFilter(item.key)}
						className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
							filter === item.key
								? 'bg-slate-900 text-white'
								: 'bg-slate-100 text-slate-600'
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			{movements.length === 0 ? (
				<p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-500">
					Tidak ada data riwayat untuk filter ini.
				</p>
			) : (
				<ul className="mt-5 space-y-3">
					{movements.map((movement) => {
						const movementUnitLabel =
							unitNameById[
								products.find((product) => product.id === movement.productId)
									?.unitId ?? ''
							] ?? '-';
						return (
							<li
								key={movement.id}
								className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex sm:items-center sm:justify-between"
							>
							<div>
								<p className="font-medium text-slate-900">
									{movement.productName}
								</p>
								<p className="text-xs text-slate-500">
									{new Date(movement.createdAt).toLocaleString('id-ID')} |{' '}
									{movement.locationLabel}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Stok setelah transaksi: {movement.balanceAfter}{' '}
									{movementUnitLabel}
									{typeof movement.countedStock === 'number'
										? ` | Stok fisik: ${movement.countedStock} ${movementUnitLabel}`
										: ''}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Catatan: {movement.note}
								</p>
							</div>
							<div className="mt-2 sm:mt-0">
								<span
									className={`rounded-full px-3 py-1 text-xs font-semibold ${movementBadgeClass(movement.type)}`}
								>
									{movementLabel(movement, movementUnitLabel)}
								</span>
							</div>
							</li>
						);
					})}
				</ul>
			)}

			<PaginationControls
				totalItems={totalItems}
				page={page}
				pageSize={pageSize}
				totalPages={totalPages}
				onChangePage={onChangePage}
				onChangePageSize={onChangePageSize}
			/>
		</div>
	);
}

function StockAnalyticsModule({
	products,
	categories,
	unitNameById,
	categoryNameById,
	outlets,
	outletStocks,
	movements,
}: {
	products: Product[];
	categories: Category[];
	unitNameById: Record<string, string>;
	categoryNameById: Record<string, string>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	movements: Movement[];
}) {
	const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
	const [period, setPeriod] = useState<AnalyticsPeriod>('last30days');

	const locationOptions = useMemo(
		() => toLocationFilterOptions(outlets),
		[outlets],
	);
	const outletStockMap = useMemo(() => {
		return outletStocks.reduce<Record<string, number>>(
			(accumulator, record) => {
				accumulator[`${record.outletId}:${record.productId}`] = record.qty;
				return accumulator;
			},
			{},
		);
	}, [outletStocks]);

	const reportRows = useMemo(() => {
		return [...products]
			.sort((a, b) => a.name.localeCompare(b.name, 'id'))
			.map((product) => {
				const outletTotal = outletStocks
					.filter((record) => record.productId === product.id)
					.reduce((sum, record) => sum + record.qty, 0);
				const totalCombined = product.stock + outletTotal;

				let filteredStock = totalCombined;
				if (locationFilter === 'central') {
					filteredStock = product.stock;
				} else if (locationFilter.startsWith('outlet:')) {
					const outletId = locationFilter.slice('outlet:'.length);
					filteredStock = outletStockMap[`${outletId}:${product.id}`] ?? 0;
				}

				return {
					id: product.id,
					name: product.name,
					sku: product.sku,
					unit: getProductUnitLabel(product, unitNameById),
					category: categoryNameById[product.categoryId] ?? '-',
					centralStock: product.stock,
					outletStock: outletTotal,
					totalCombined,
					filteredStock,
				};
			});
	}, [
		categoryNameById,
		locationFilter,
		outletStockMap,
		outletStocks,
		products,
		unitNameById,
	]);

	const trendData = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const buckets: Array<{
			key: string;
			label: string;
			startMs: number;
			endMs: number;
		}> = [];

		if (period === 'last30days') {
			for (let offset = 29; offset >= 0; offset -= 1) {
				const start = new Date(today);
				start.setDate(today.getDate() - offset);
				const end = new Date(start);
				end.setHours(23, 59, 59, 999);
				buckets.push({
					key: formatDateKey(start),
					label: start.toLocaleDateString('id-ID', {
						day: '2-digit',
						month: 'short',
					}),
					startMs: start.getTime(),
					endMs: end.getTime(),
				});
			}
		} else if (period === 'monthly') {
			for (let offset = 11; offset >= 0; offset -= 1) {
				const start = new Date(
					today.getFullYear(),
					today.getMonth() - offset,
					1,
				);
				const end = new Date(
					start.getFullYear(),
					start.getMonth() + 1,
					0,
					23,
					59,
					59,
					999,
				);
				buckets.push({
					key: formatMonthKey(start),
					label: start.toLocaleDateString('id-ID', {
						month: 'short',
						year: '2-digit',
					}),
					startMs: start.getTime(),
					endMs: end.getTime(),
				});
			}
		} else {
			for (let offset = 4; offset >= 0; offset -= 1) {
				const year = today.getFullYear() - offset;
				const start = new Date(year, 0, 1);
				const end = new Date(year, 11, 31, 23, 59, 59, 999);
				buckets.push({
					key: `${year}`,
					label: `${year}`,
					startMs: start.getTime(),
					endMs: end.getTime(),
				});
			}
		}

		const firstBucket = buckets[0];
		const lastBucket = buckets[buckets.length - 1];
		if (!firstBucket || !lastBucket) {
			return [];
		}

		const aggregated = buckets.reduce<
			Record<string, { inQty: number; outQty: number }>
		>((accumulator, bucket) => {
			accumulator[bucket.key] = { inQty: 0, outQty: 0 };
			return accumulator;
		}, {});

		movements.forEach((movement) => {
			if (
				movement.type === 'opname' ||
				!isMovementInLocation(movement, locationFilter)
			) {
				return;
			}

			const createdAt = new Date(movement.createdAt);
			const time = createdAt.getTime();
			if (time < firstBucket.startMs || time > lastBucket.endMs) {
				return;
			}

			let bucketKey = '';
			if (period === 'last30days') {
				bucketKey = formatDateKey(createdAt);
			} else if (period === 'monthly') {
				bucketKey = formatMonthKey(createdAt);
			} else {
				bucketKey = `${createdAt.getFullYear()}`;
			}

			if (!aggregated[bucketKey]) {
				return;
			}

			if (movement.type === 'in') {
				aggregated[bucketKey].inQty += movement.qty;
			} else if (movement.type === 'out') {
				aggregated[bucketKey].outQty += movement.qty;
			}
		});

		return buckets.map((bucket) => {
			const inQty = aggregated[bucket.key]?.inQty ?? 0;
			const outQty = aggregated[bucket.key]?.outQty ?? 0;
			return {
				key: bucket.key,
				label: bucket.label,
				inQty,
				outQty,
				netQty: inQty - outQty,
			};
		});
	}, [locationFilter, movements, period]);

	const metrics = useMemo(() => {
		return trendData.reduce(
			(accumulator, row) => {
				return {
					inQty: accumulator.inQty + row.inQty,
					outQty: accumulator.outQty + row.outQty,
					netQty: accumulator.netQty + row.netQty,
				};
			},
			{ inQty: 0, outQty: 0, netQty: 0 },
		);
	}, [trendData]);

	const currentScopeTotalStock = useMemo(() => {
		return reportRows.reduce((sum, row) => sum + row.filteredStock, 0);
	}, [reportRows]);

	const locationLabel = getLocationFilterLabel(locationFilter, outlets);

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Analitik Stok</h2>
				<p className="mt-1 text-sm text-slate-500">
					Laporan data barang dan tren pergerakan stok per periode.
				</p>

				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<label className="text-sm font-medium text-slate-700">
						Lokasi
						<select
							value={locationFilter}
							onChange={(event) =>
								setLocationFilter(event.target.value as LocationFilter)
							}
							className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-violet-500 focus:outline-none"
						>
							{locationOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>

					<label className="text-sm font-medium text-slate-700">
						Periode Tren
						<select
							value={period}
							onChange={(event) =>
								setPeriod(event.target.value as AnalyticsPeriod)
							}
							className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-violet-500 focus:outline-none"
						>
							<option value="last30days">30 Hari</option>
							<option value="monthly">Bulanan (12 bulan)</option>
							<option value="yearly">Tahunan (5 tahun)</option>
						</select>
					</label>
				</div>

				<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<StatCard label="Produk Aktif" value={products.length} />
					<StatCard label="Kategori" value={categories.length} />
					<StatCard label="Total Stok Filter" value={currentScopeTotalStock} />
					<StatCard label="Lokasi" value={locationLabel} />
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<h3 className="text-base font-semibold text-slate-900">
						Tren Pergerakan Stok
					</h3>
					<span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
						{locationLabel}
					</span>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<StatCard label="Total Masuk" value={metrics.inQty} />
					<StatCard label="Total Keluar" value={metrics.outQty} />
					<StatCard label="Net" value={metrics.netQty} />
				</div>

				<div className="mt-5">
					<div className="h-56 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:h-64 sm:p-3">
						<ResponsiveContainer width="100%" height="100%">
							<ComposedChart
								data={trendData}
								margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
							>
								<CartesianGrid
									strokeDasharray="4 4"
									vertical={false}
									stroke="#e2e8f0"
								/>
								<XAxis
									dataKey="label"
									tick={{ fontSize: 10 }}
									minTickGap={period === 'last30days' ? 22 : 14}
								/>
								<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
								<Tooltip
									contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
									formatter={(
										value: number | string | undefined,
										name: string | undefined,
									) => [`${Number(value ?? 0)} unit`, name ?? '-']}
								/>
								<Legend />
								<Bar
									dataKey="inQty"
									name="Masuk"
									fill="#10b981"
									radius={[6, 6, 0, 0]}
									animationDuration={650}
								/>
								<Bar
									dataKey="outQty"
									name="Keluar"
									fill="#f97316"
									radius={[6, 6, 0, 0]}
									animationDuration={700}
								/>
								<Line
									type="monotone"
									dataKey="netQty"
									name="Net"
									stroke="#7c3aed"
									strokeWidth={2.5}
									dot={period === 'yearly'}
									animationDuration={900}
								/>
							</ComposedChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className="mt-4">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="text-xs uppercase tracking-wide text-slate-500">
								<th className="px-2 py-2">Periode</th>
								<th className="px-2 py-2">Masuk</th>
								<th className="px-2 py-2">Keluar</th>
								<th className="px-2 py-2">Net</th>
							</tr>
						</thead>
						<tbody>
							{trendData.map((row) => (
								<tr
									key={row.key}
									className="border-t border-slate-100 text-slate-700"
								>
									<td className="px-2 py-2">{row.label}</td>
									<td className="px-2 py-2">{row.inQty}</td>
									<td className="px-2 py-2">{row.outQty}</td>
									<td
										className={`px-2 py-2 font-semibold ${row.netQty < 0 ? 'text-red-600' : 'text-emerald-600'}`}
									>
										{row.netQty}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h3 className="text-base font-semibold text-slate-900">
					Laporan Data Barang
				</h3>
				<p className="mt-1 text-sm text-slate-500">
					Menampilkan stok pusat, stok outlet, dan total gabungan per produk.
				</p>

				<div className="mt-4 space-y-3 md:hidden">
					{reportRows.map((row) => (
						<article
							key={row.id}
							className="rounded-xl border border-slate-200 bg-slate-50 p-3"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-slate-900">
										{row.name}
									</p>
									<p className="text-xs text-slate-500">
										{row.sku} | {row.category} | {row.unit}
									</p>
								</div>
								<span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
									{row.filteredStock} {row.unit}
								</span>
							</div>

							<div className="mt-3 grid grid-cols-3 gap-2 text-center">
								<div className="rounded-lg bg-white px-2 py-2">
									<p className="text-[11px] uppercase tracking-wide text-slate-500">
										Pusat
									</p>
									<p className="text-sm font-semibold text-slate-800">
										{row.centralStock}
									</p>
								</div>
								<div className="rounded-lg bg-white px-2 py-2">
									<p className="text-[11px] uppercase tracking-wide text-slate-500">
										Outlet
									</p>
									<p className="text-sm font-semibold text-slate-800">
										{row.outletStock}
									</p>
								</div>
								<div className="rounded-lg bg-white px-2 py-2">
									<p className="text-[11px] uppercase tracking-wide text-slate-500">
										Gabungan
									</p>
									<p className="text-sm font-semibold text-slate-800">
										{row.totalCombined}
									</p>
								</div>
							</div>
						</article>
					))}
				</div>

				<div className="mt-4 hidden md:block">
					<table className="w-full table-fixed text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
								<th className="w-[24%] px-2 py-2">Produk</th>
								<th className="w-[14%] px-2 py-2">SKU</th>
								<th className="w-[18%] px-2 py-2">Kategori</th>
								<th className="w-[12%] px-2 py-2">Satuan</th>
								<th className="w-[9%] px-2 py-2">Pusat</th>
								<th className="w-[9%] px-2 py-2">Outlet</th>
								<th className="w-[9%] px-2 py-2">Gabungan</th>
								<th className="w-[9%] px-2 py-2">Filter</th>
							</tr>
						</thead>
						<tbody>
							{reportRows.map((row) => (
								<tr
									key={row.id}
									className="border-b border-slate-100 text-slate-700"
								>
									<td className="px-2 py-2 font-medium">
										<p className="truncate">{row.name}</p>
									</td>
									<td className="px-2 py-2">{row.sku}</td>
									<td className="px-2 py-2">
										<p className="truncate">{row.category}</p>
									</td>
									<td className="px-2 py-2">{row.unit}</td>
									<td className="px-2 py-2">{row.centralStock}</td>
									<td className="px-2 py-2">{row.outletStock}</td>
									<td className="px-2 py-2">{row.totalCombined}</td>
									<td className="px-2 py-2 font-semibold text-violet-700">
										{row.filteredStock}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function ExportStockModule({
	products,
	unitNameById,
	categoryNameById,
	outlets,
	outletStocks,
	onSuccess,
	onError,
}: {
	products: Product[];
	unitNameById: Record<string, string>;
	categoryNameById: Record<string, string>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	onSuccess: (message: string) => void;
	onError: (message: string) => void;
}) {
	const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
	const locationOptions = useMemo(
		() => toLocationFilterOptions(outlets),
		[outlets],
	);

	const sheetRows = useMemo(() => {
		const now = new Date();
		const exportedAt = now.toLocaleString('id-ID');
		const rows: Array<{
			'Tanggal Export': string;
			Lokasi: string;
			Produk: string;
			SKU: string;
			Kategori: string;
			Satuan: string;
			Qty: number;
		}> = [];

		const pushProductRows = (
			locationName: string,
			quantityByProductId: Record<string, number>,
		) => {
			products.forEach((product) => {
				rows.push({
					'Tanggal Export': exportedAt,
					Lokasi: locationName,
					Produk: product.name,
					SKU: product.sku,
					Kategori: categoryNameById[product.categoryId] ?? '-',
					Satuan: getProductUnitLabel(product, unitNameById),
					Qty: quantityByProductId[product.id] ?? 0,
				});
			});
		};

		if (locationFilter === 'all' || locationFilter === 'central') {
			const centralQuantities = products.reduce<Record<string, number>>(
				(accumulator, product) => {
					accumulator[product.id] = product.stock;
					return accumulator;
				},
				{},
			);
			pushProductRows('Pusat', centralQuantities);
		}

		if (locationFilter === 'all') {
			outlets.forEach((outlet) => {
				const outletQuantities = outletStocks.reduce<Record<string, number>>(
					(accumulator, record) => {
						if (record.outletId === outlet.id) {
							accumulator[record.productId] = record.qty;
						}
						return accumulator;
					},
					{},
				);
				pushProductRows(`${outlet.name} (${outlet.code})`, outletQuantities);
			});
		} else if (locationFilter.startsWith('outlet:')) {
			const outletId = locationFilter.slice('outlet:'.length);
			const outlet = outlets.find((item) => item.id === outletId);
			if (outlet) {
				const outletQuantities = outletStocks.reduce<Record<string, number>>(
					(accumulator, record) => {
						if (record.outletId === outlet.id) {
							accumulator[record.productId] = record.qty;
						}
						return accumulator;
					},
					{},
				);
				pushProductRows(`${outlet.name} (${outlet.code})`, outletQuantities);
			}
		}

		return rows;
	}, [
		categoryNameById,
		locationFilter,
		outletStocks,
		outlets,
		products,
		unitNameById,
	]);

	const handleExportExcel = () => {
		if (sheetRows.length === 0) {
			onError(
				'Ekspor dibatalkan. Tidak ada data stok untuk lokasi yang dipilih.',
			);
			return;
		}

		const now = new Date();
		const filename = `stok-snapshot-${now.getFullYear()}-${padDatePart(
			now.getMonth() + 1,
		)}-${padDatePart(now.getDate())}_${padDatePart(now.getHours())}-${padDatePart(now.getMinutes())}.xlsx`;

		const worksheet = XLSX.utils.json_to_sheet(sheetRows);
		worksheet['!cols'] = [
			{ wch: 20 },
			{ wch: 30 },
			{ wch: 28 },
			{ wch: 16 },
			{ wch: 22 },
			{ wch: 14 },
			{ wch: 10 },
		];
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Snapshot');
		XLSX.writeFile(workbook, filename);
		onSuccess(`Ekspor Excel berhasil: ${filename}`);
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">
					Fitur Ekspor Data
				</h2>
				<p className="mt-1 text-sm text-slate-500">
					Ekspor snapshot stok per lokasi ke format Excel.
				</p>

				<div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
					<label className="text-sm font-medium text-slate-700">
						Lokasi
						<select
							value={locationFilter}
							onChange={(event) =>
								setLocationFilter(event.target.value as LocationFilter)
							}
							className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-violet-500 focus:outline-none"
						>
							{locationOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>

					<button
						type="button"
						onClick={handleExportExcel}
						className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
					>
						Ekspor Excel
					</button>
				</div>

				<div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-700">
					Lokasi dipilih:{' '}
					<span className="font-semibold">
						{getLocationFilterLabel(locationFilter, outlets)}
					</span>{' '}
					| Total baris siap ekspor:{' '}
					<span className="font-semibold">{sheetRows.length}</span>
				</div>
			</div>
		</div>
	);
}

function ManageProducts({
	products,
	categories,
	units,
	categoryNameById,
	unitNameById,
	page,
	pageSize,
	onChangePage,
	onChangePageSize,
	onCreate,
	onUpdate,
	onDelete,
}: {
	products: Product[];
	categories: Category[];
	units: Unit[];
	categoryNameById: Record<string, string>;
	unitNameById: Record<string, string>;
	page: number;
	pageSize: PageSize;
	onChangePage: (page: number) => void;
	onChangePageSize: (size: PageSize) => void;
	onCreate: (payload: {
		name: string;
		sku: string;
		initialStock: number;
		categoryId: string;
		unitId: string;
	}) => boolean;
	onUpdate: (payload: {
		productId: string;
		name: string;
		sku: string;
		categoryId: string;
		unitId: string;
	}) => boolean;
	onDelete: (productId: string) => boolean;
}) {
	const [newName, setNewName] = useState('');
	const [newSku, setNewSku] = useState('');
	const [newStockInput, setNewStockInput] = useState('0');
	const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id ?? '');
	const [newUnitId, setNewUnitId] = useState(units[0]?.id ?? '');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState('');
	const [editingSku, setEditingSku] = useState('');
	const [editingCategoryId, setEditingCategoryId] = useState('');
	const [editingUnitId, setEditingUnitId] = useState('');
	const [newNameError, setNewNameError] = useState('');
	const [editingNameError, setEditingNameError] = useState('');
	const [isGeneratingSku, setIsGeneratingSku] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState('all');
	const [productQuery, setProductQuery] = useState('');
	const newStock = Math.max(0, parseIntegerInput(newStockInput, 0));
	const unitOptions = useMemo(
		() =>
			units.map((unit) => ({
				value: unit.id,
				label: unit.name,
			})),
		[units],
	);

	const categoryUsageCount = useMemo(() => {
		return products.reduce<Record<string, number>>((accumulator, product) => {
			accumulator[product.categoryId] =
				(accumulator[product.categoryId] ?? 0) + 1;
			return accumulator;
		}, {});
	}, [products]);

	const categoryFilterOptions = useMemo(
		() => [
			{
				value: 'all',
				label: 'Semua kategori',
				description: `${products.length} produk`,
			},
			...categories.map((category) => ({
				value: category.id,
				label: category.name,
				description: `${categoryUsageCount[category.id] ?? 0} produk`,
			})),
		],
		[categories, categoryUsageCount, products.length],
	);

	useEffect(() => {
		if (
			categories.length > 0 &&
			!categories.some((category) => category.id === newCategoryId)
		) {
			setNewCategoryId(categories[0].id);
		}

		if (
			categories.length > 0 &&
			editingId &&
			!categories.some((category) => category.id === editingCategoryId)
		) {
			setEditingCategoryId(categories[0].id);
		}
	}, [categories, editingCategoryId, editingId, newCategoryId]);

	useEffect(() => {
		if (units.length > 0 && !units.some((unit) => unit.id === newUnitId)) {
			setNewUnitId(units[0].id);
		}
		if (
			units.length > 0 &&
			editingId &&
			!units.some((unit) => unit.id === editingUnitId)
		) {
			setEditingUnitId(units[0].id);
		}
	}, [editingId, editingUnitId, newUnitId, units]);

	useEffect(() => {
		if (
			!categoryFilterOptions.some((option) => option.value === categoryFilter)
		) {
			setCategoryFilter('all');
			onChangePage(1);
		}
	}, [categoryFilter, categoryFilterOptions, onChangePage]);

	const filteredProducts = useMemo(() => {
		const source = [...products].sort((a, b) =>
			a.name.localeCompare(b.name, 'id'),
		);
		const normalizedQuery = productQuery.trim().toLowerCase();

		const categoryFiltered =
			categoryFilter === 'all'
				? source
				: source.filter((product) => product.categoryId === categoryFilter);

		if (!normalizedQuery) {
			return categoryFiltered;
		}

		return categoryFiltered.filter((product) => {
			const name = product.name.toLowerCase();
			const sku = product.sku.toLowerCase();
			return name.includes(normalizedQuery) || sku.includes(normalizedQuery);
		});
	}, [categoryFilter, productQuery, products]);

	const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
	const safePage = Math.min(page, totalPages);

	useEffect(() => {
		if (page !== safePage) {
			onChangePage(safePage);
		}
	}, [onChangePage, page, safePage]);

	const pagedProducts = useMemo(() => {
		const start = (safePage - 1) * pageSize;
		return filteredProducts.slice(start, start + pageSize);
	}, [filteredProducts, pageSize, safePage]);

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Kelola Produk</h2>
				<p className="mt-1 text-sm text-slate-500">
					Tambah dan perbarui data produk. Setiap produk wajib memiliki
					kategori.
				</p>

				<form
					className="mt-4 grid gap-3 sm:grid-cols-2"
					onSubmit={(event: FormEvent<HTMLFormElement>) => {
						event.preventDefault();

						const success = onCreate({
							name: newName,
							sku: newSku,
							initialStock: newStock,
							categoryId: newCategoryId,
							unitId: newUnitId,
						});

						if (success) {
							setNewName('');
							setNewSku('');
							setNewStockInput('0');
							if (categories[0]) {
								setNewCategoryId(categories[0].id);
							}
							if (units[0]) {
								setNewUnitId(units[0].id);
							}
						}
					}}
				>
					<input
						value={newName}
						onChange={(event) => {
							setNewName(event.target.value);
							if (newNameError) {
								setNewNameError('');
							}
						}}
						placeholder="Nama produk"
						className={`rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-slate-500 ${
							newNameError ? 'border-red-400' : 'border-slate-300'
						}`}
						required
					/>
					<div className="flex gap-2">
						<input
							value={newSku}
							onChange={(event) => setNewSku(event.target.value)}
							placeholder="SKU"
							className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none transition focus:border-slate-500"
							required
						/>
						<button
							type="button"
							onClick={async () => {
								const cleanedName = newName.trim();
								if (!cleanedName) {
									setNewNameError(
										'Nama produk wajib diisi sebelum generate SKU.',
									);
									return;
								}

								setIsGeneratingSku(true);
								await new Promise((resolve) => setTimeout(resolve, 700));
								setNewSku(buildSkuFromName(cleanedName, products));
								setIsGeneratingSku(false);
							}}
							disabled={isGeneratingSku}
							className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
						>
							Generate SKU
						</button>
					</div>
					{newNameError ? (
						<p className="-mt-1 text-xs text-red-600 sm:col-span-2">
							{newNameError}
						</p>
					) : null}
					<CategorySelectDropdown
						categories={categories}
						value={newCategoryId}
						onChange={setNewCategoryId}
					/>
					<SearchableOptionDropdown
						label="Satuan"
						options={unitOptions}
						value={newUnitId}
						onChange={setNewUnitId}
						buttonPlaceholder="Pilih satuan"
						searchPlaceholder="Cari satuan..."
						emptyText="Satuan tidak ditemukan."
					/>
					<input
						type="number"
						min={0}
						step={1}
						value={newStockInput}
						onChange={(event) => {
							const raw = event.target.value;
							setNewStockInput(raw);
							if (raw === '') {
								return;
							}
							setNewStockInput(`${Math.max(0, parseIntegerInput(raw, 0))}`);
						}}
						placeholder="Stok awal"
						className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						required
					/>
					<button
						type="submit"
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 sm:col-span-2"
					>
						Tambah Produk
					</button>
				</form>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
						Daftar Produk
					</h3>
					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
						<input
							value={productQuery}
							onChange={(event) => {
								setProductQuery(event.target.value);
								onChangePage(1);
							}}
							placeholder="Cari nama produk / SKU"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 sm:w-64"
						/>
						<CategoryFilterDropdown
							value={categoryFilter}
							options={categoryFilterOptions}
							onChange={(next) => {
								setCategoryFilter(next);
								onChangePage(1);
							}}
						/>
					</div>
				</div>

				{pagedProducts.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">
						Tidak ada produk untuk filter ini.
					</p>
				) : (
					<ul className="mt-4 space-y-3">
						{pagedProducts.map((product) => {
							const isEditing = editingId === product.id;

							return (
								<li
									key={product.id}
									className="rounded-xl border border-slate-200 bg-slate-50 p-3"
								>
									{isEditing ? (
										<div className="grid gap-2 sm:grid-cols-2">
											<input
												value={editingName}
												onChange={(event) => {
													setEditingName(event.target.value);
													if (editingNameError) {
														setEditingNameError('');
													}
												}}
												className={`rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-500 ${
													editingNameError
														? 'border-red-400'
														: 'border-slate-300'
												}`}
											/>
											<div className="flex gap-2">
												<input
													value={editingSku}
													onChange={(event) =>
														setEditingSku(event.target.value)
													}
													className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
												/>
												<button
													type="button"
													onClick={async () => {
														const cleanedName = editingName.trim();
														if (!cleanedName) {
															setEditingNameError(
																'Nama produk wajib diisi sebelum generate SKU.',
															);
															return;
														}

														setIsGeneratingSku(true);
														await new Promise((resolve) =>
															setTimeout(resolve, 700),
														);
														setEditingSku(
															buildSkuFromName(
																cleanedName,
																products,
																product.id,
															),
														);
														setIsGeneratingSku(false);
													}}
													disabled={isGeneratingSku}
													className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
												>
													Generate SKU
												</button>
											</div>
											{editingNameError ? (
												<p className="-mt-1 text-xs text-red-600 sm:col-span-2">
													{editingNameError}
												</p>
											) : null}
											<CategorySelectDropdown
												categories={categories}
												value={editingCategoryId}
												onChange={setEditingCategoryId}
												compact
											/>
											<SearchableOptionDropdown
												label="Satuan"
												options={unitOptions}
												value={editingUnitId}
												onChange={setEditingUnitId}
												buttonPlaceholder="Pilih satuan"
												searchPlaceholder="Cari satuan..."
												emptyText="Satuan tidak ditemukan."
												compact
											/>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														const success = onUpdate({
															productId: product.id,
															name: editingName,
															sku: editingSku,
															categoryId: editingCategoryId,
															unitId: editingUnitId,
														});

														if (success) {
															setEditingId(null);
														}
													}}
													className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
												>
													Simpan
												</button>
												<button
													type="button"
													onClick={() => setEditingId(null)}
													className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
												>
													Batal
												</button>
											</div>
										</div>
									) : (
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="font-medium text-slate-900">
													{product.name}
												</p>
												<p className="text-xs text-slate-500">
													SKU: {product.sku} | Kategori:{' '}
													{categoryNameById[product.categoryId] ?? '-'} | Satuan:{' '}
													{unitNameById[product.unitId] ?? '-'} | Stok pusat:{' '}
													{product.stock}
												</p>
											</div>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														setEditingId(product.id);
														setEditingName(product.name);
														setEditingSku(product.sku);
														setEditingCategoryId(product.categoryId);
														setEditingUnitId(product.unitId);
														setEditingNameError('');
													}}
													className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
												>
													Ubah
												</button>
												<button
													type="button"
													onClick={() => onDelete(product.id)}
													className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
												>
													Hapus
												</button>
											</div>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}

				<PaginationControls
					totalItems={filteredProducts.length}
					page={safePage}
					pageSize={pageSize}
					totalPages={totalPages}
					onChangePage={onChangePage}
					onChangePageSize={onChangePageSize}
				/>
			</div>
			<SkuGeneratingModal isOpen={isGeneratingSku} />
		</div>
	);
}

function CategoryManager({
	categories,
	products,
	onCreate,
	onUpdate,
	onDelete,
}: {
	categories: Category[];
	products: Product[];
	onCreate: (payload: { name: string }) => boolean;
	onUpdate: (payload: { categoryId: string; name: string }) => boolean;
	onDelete: (categoryId: string) => boolean;
}) {
	const [newName, setNewName] = useState('');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState('');

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">
					Kelola Kategori
				</h2>
				<p className="mt-1 text-sm text-slate-500">
					Kategori dipakai pada master produk dan wajib dipilih.
				</p>

				<form
					className="mt-4 flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						const success = onCreate({ name: newName });
						if (success) {
							setNewName('');
						}
					}}
				>
					<input
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						placeholder="Nama kategori"
						className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						required
					/>
					<button
						type="submit"
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
					>
						Tambah
					</button>
				</form>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
					Daftar Kategori
				</h3>

				{categories.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">Belum ada kategori.</p>
				) : (
					<ul className="mt-4 space-y-2">
						{categories.map((category) => {
							const usageCount = products.filter(
								(product) => product.categoryId === category.id,
							).length;
							const isEditing = editingId === category.id;

							return (
								<li
									key={category.id}
									className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
								>
									{isEditing ? (
										<div className="flex flex-wrap items-center gap-2">
											<input
												value={editingName}
												onChange={(event) => setEditingName(event.target.value)}
												className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
											/>
											<button
												type="button"
												onClick={() => {
													const success = onUpdate({
														categoryId: category.id,
														name: editingName,
													});

													if (success) {
														setEditingId(null);
													}
												}}
												className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
											>
												Simpan
											</button>
											<button
												type="button"
												onClick={() => setEditingId(null)}
												className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
											>
												Batal
											</button>
										</div>
									) : (
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="text-sm font-medium text-slate-900">
													{category.name}
												</p>
												<p className="text-xs text-slate-500">
													Dipakai oleh {usageCount} produk
												</p>
											</div>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														setEditingId(category.id);
														setEditingName(category.name);
													}}
													className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
												>
													Ubah
												</button>
												<button
													type="button"
													onClick={() => onDelete(category.id)}
													className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
												>
													Hapus
												</button>
											</div>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

function UnitManager({
	units,
	products,
	onCreate,
	onUpdate,
	onDelete,
}: {
	units: Unit[];
	products: Product[];
	onCreate: (payload: { name: string }) => boolean;
	onUpdate: (payload: { unitId: string; name: string }) => boolean;
	onDelete: (unitId: string) => boolean;
}) {
	const [newName, setNewName] = useState('');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState('');

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Kelola Satuan</h2>
				<p className="mt-1 text-sm text-slate-500">
					Satuan dipakai pada master produk dan wajib dipilih.
				</p>

				<form
					className="mt-4 flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						const success = onCreate({ name: newName });
						if (success) {
							setNewName('');
						}
					}}
				>
					<input
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						placeholder="Nama satuan"
						className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						required
					/>
					<button
						type="submit"
						className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
					>
						Tambah
					</button>
				</form>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
					Daftar Satuan
				</h3>

				{units.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">Belum ada satuan.</p>
				) : (
					<ul className="mt-4 space-y-2">
						{units.map((unit) => {
							const usageCount = products.filter(
								(product) => product.unitId === unit.id,
							).length;
							const isEditing = editingId === unit.id;

							return (
								<li
									key={unit.id}
									className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
								>
									{isEditing ? (
										<div className="flex flex-wrap items-center gap-2">
											<input
												value={editingName}
												onChange={(event) => setEditingName(event.target.value)}
												className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
											/>
											<button
												type="button"
												onClick={() => {
													const success = onUpdate({
														unitId: unit.id,
														name: editingName,
													});
													if (success) {
														setEditingId(null);
													}
												}}
												className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
											>
												Simpan
											</button>
											<button
												type="button"
												onClick={() => setEditingId(null)}
												className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
											>
												Batal
											</button>
										</div>
									) : (
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="text-sm font-medium text-slate-900">
													{unit.name}
												</p>
												<p className="text-xs text-slate-500">
													Dipakai oleh {usageCount} produk
												</p>
											</div>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														setEditingId(unit.id);
														setEditingName(unit.name);
													}}
													className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
												>
													Ubah
												</button>
												<button
													type="button"
													onClick={() => onDelete(unit.id)}
													className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
												>
													Hapus
												</button>
											</div>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

function OutletManager({
	outlets,
	outletStocks,
	products,
	onCreate,
	onUpdate,
	onDelete,
}: {
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	products: Product[];
	onCreate: (payload: {
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => boolean;
	onUpdate: (payload: {
		outletId: string;
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => boolean;
	onDelete: (outletId: string) => boolean;
}) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [code, setCode] = useState('');
	const [address, setAddress] = useState('');
	const [latitude, setLatitude] = useState(DEFAULT_COORDINATES.latitude);
	const [longitude, setLongitude] = useState(DEFAULT_COORDINATES.longitude);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchError, setSearchError] = useState('');

	useEffect(() => {
		const normalizedQuery = searchQuery.trim();

		if (normalizedQuery.length < 3) {
			setSearchResults([]);
			setSearchError('');
			return;
		}

		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			setSearchLoading(true);
			setSearchError('');

			try {
				const response = await fetch(
					`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(
						normalizedQuery,
					)}`,
					{
						signal: controller.signal,
						headers: {
							Accept: 'application/json',
						},
					},
				);

				if (!response.ok) {
					throw new Error('Gagal mengambil data lokasi.');
				}

				const data = (await response.json()) as GeocodeResult[];
				setSearchResults(data);
			} catch (fetchError) {
				if (controller.signal.aborted) {
					return;
				}

				setSearchError('Pencarian alamat gagal. Coba lagi.');
			} finally {
				if (!controller.signal.aborted) {
					setSearchLoading(false);
				}
			}
		}, 400);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [searchQuery]);

	const clearForm = () => {
		setEditingId(null);
		setName('');
		setCode('');
		setAddress('');
		setLatitude(DEFAULT_COORDINATES.latitude);
		setLongitude(DEFAULT_COORDINATES.longitude);
		setSearchQuery('');
		setSearchResults([]);
		setSearchError('');
	};

	const beginEdit = (outlet: Outlet) => {
		setEditingId(outlet.id);
		setName(outlet.name);
		setCode(outlet.code);
		setAddress(outlet.address);
		setLatitude(outlet.latitude);
		setLongitude(outlet.longitude);
		setSearchQuery(outlet.address);
		setSearchResults([]);
		setSearchError('');
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">
					{editingId ? 'Ubah Outlet' : 'Tambah Outlet'}
				</h2>
				<p className="mt-1 text-sm text-slate-500">
					Lengkapi nama, kode, alamat, dan titik koordinat outlet dari peta.
				</p>

				<form
					className="mt-4 space-y-3"
					onSubmit={(event) => {
						event.preventDefault();

						const payload = {
							name,
							code,
							address,
							latitude,
							longitude,
						};

						const success = editingId
							? onUpdate({ outletId: editingId, ...payload })
							: onCreate(payload);

						if (success) {
							clearForm();
						}
					}}
				>
					<div className="grid gap-3 sm:grid-cols-2">
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Nama outlet"
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
						<input
							value={code}
							onChange={(event) => setCode(event.target.value)}
							placeholder="Kode outlet"
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none transition focus:border-slate-500"
							required
						/>
					</div>

					<input
						value={address}
						onChange={(event) => setAddress(event.target.value)}
						placeholder="Alamat outlet"
						className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						required
					/>

					<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
						<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Cari alamat (Nominatim OSM)
						</label>
						<input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Ketik alamat minimal 3 karakter"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						/>
						{searchLoading ? (
							<p className="mt-2 text-xs text-slate-500">Mencari alamat...</p>
						) : null}
						{searchError ? (
							<p className="mt-2 text-xs text-red-600">{searchError}</p>
						) : null}
						{searchResults.length > 0 ? (
							<ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
								{searchResults.map((result, index) => (
									<li key={`${result.lat}-${result.lon}-${index}`}>
										<button
											type="button"
											onClick={() => {
												const nextLatitude = Number(result.lat);
												const nextLongitude = Number(result.lon);
												if (
													!Number.isFinite(nextLatitude) ||
													!Number.isFinite(nextLongitude)
												) {
													return;
												}

												setLatitude(nextLatitude);
												setLongitude(nextLongitude);
												setAddress(result.display_name);
												setSearchQuery(result.display_name);
												setSearchResults([]);
											}}
											className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
										>
											{result.display_name}
										</button>
									</li>
								))}
							</ul>
						) : null}
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<input
							type="number"
							step="any"
							value={latitude}
							onChange={(event) => {
								const value = Number(event.target.value);
								setLatitude(Number.isFinite(value) ? value : 0);
							}}
							placeholder="Latitude"
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
						<input
							type="number"
							step="any"
							value={longitude}
							onChange={(event) => {
								const value = Number(event.target.value);
								setLongitude(Number.isFinite(value) ? value : 0);
							}}
							placeholder="Longitude"
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
					</div>

					<OutletMapPicker
						latitude={latitude}
						longitude={longitude}
						onChange={({
							latitude: nextLatitude,
							longitude: nextLongitude,
						}) => {
							setLatitude(nextLatitude);
							setLongitude(nextLongitude);
						}}
					/>

					<div className="flex flex-wrap gap-2">
						<button
							type="submit"
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
						>
							{editingId ? 'Simpan Perubahan Outlet' : 'Tambah Outlet'}
						</button>
						{editingId ? (
							<button
								type="button"
								onClick={clearForm}
								className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
							>
								Batal
							</button>
						) : null}
					</div>
				</form>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
					Daftar Outlet
				</h3>

				{outlets.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">Belum ada outlet.</p>
				) : (
					<ul className="mt-4 space-y-3">
						{outlets.map((outlet) => {
							const totalStock = outletStocks
								.filter((record) => record.outletId === outlet.id)
								.reduce((sum, record) => sum + record.qty, 0);

							const activeProductCount = new Set(
								outletStocks
									.filter(
										(record) => record.outletId === outlet.id && record.qty > 0,
									)
									.map((record) => record.productId),
							).size;

							return (
								<li
									key={outlet.id}
									className="rounded-xl border border-slate-200 bg-slate-50 p-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="font-medium text-slate-900">
												{outlet.name} ({outlet.code})
											</p>
											<p className="text-xs text-slate-500">{outlet.address}</p>
											<p className="mt-1 text-xs text-slate-500">
												Koordinat: {outlet.latitude.toFixed(6)},{' '}
												{outlet.longitude.toFixed(6)}
											</p>
											<p className="mt-1 text-xs text-slate-500">
												Produk aktif: {activeProductCount} | Total stok outlet:{' '}
												{totalStock} unit
											</p>
										</div>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => beginEdit(outlet)}
												className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
											>
												Ubah
											</button>
											<button
												type="button"
												onClick={() => onDelete(outlet.id)}
												className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
											>
												Hapus
											</button>
										</div>
									</div>

									<div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
										Produk tersedia:{' '}
										{products
											.filter((product) =>
												outletStocks.some(
													(record) =>
														record.outletId === outlet.id &&
														record.productId === product.id &&
														record.qty > 0,
												),
											)
											.map((product) => product.name)
											.join(', ') || 'Belum ada stok produk'}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

function TransferModule({
	products,
	unitNameById,
	outlets,
	transfers,
	totalTransferItems,
	transferPage,
	transferPageSize,
	transferTotalPages,
	getStockByLocation,
	onSubmit,
	onChangePage,
	onChangePageSize,
}: {
	products: Product[];
	unitNameById: Record<string, string>;
	outlets: Outlet[];
	transfers: TransferRecord[];
	totalTransferItems: number;
	transferPage: number;
	transferPageSize: PageSize;
	transferTotalPages: number;
	getStockByLocation: (productId: string, location: StockLocation) => number;
	onSubmit: (payload: {
		productId: string;
		source: StockLocation;
		destinations: Array<{ outletId: string; qty: number }>;
		note: string;
	}) => boolean;
	onChangePage: (page: number) => void;
	onChangePageSize: (size: PageSize) => void;
}) {
	const [sourceValue, setSourceValue] = useState('central');
	const [productId, setProductId] = useState(products[0]?.id ?? '');
	const [note, setNote] = useState('');
	const [rows, setRows] = useState<
		Array<{ id: string; outletId: string; qtyInput: string }>
	>([
		{
			id: createId(),
			outletId: outlets[0]?.id ?? '',
			qtyInput: '1',
		},
	]);
	const sourceOptions = useMemo(
		() => [
			{
				value: 'central',
				label: 'Pusat',
				description: 'Gudang pusat',
			},
			...outlets.map((outlet) => ({
				value: `outlet:${outlet.id}`,
				label: `${outlet.name} (${outlet.code})`,
				description: outlet.address,
			})),
		],
		[outlets],
	);
	const destinationOptions = useMemo(
		() =>
			outlets.map((outlet) => ({
				value: outlet.id,
				label: `${outlet.name} (${outlet.code})`,
				description: outlet.address,
			})),
		[outlets],
	);
	const productOptions = useMemo(
		() =>
			products.map((product) => ({
				value: product.id,
				label: `${product.name} (${product.sku})`,
				description: `Stok pusat: ${product.stock} ${getProductUnitLabel(product, unitNameById)}`,
			})),
		[products, unitNameById],
	);

	useEffect(() => {
		if (products.length === 0) {
			setProductId('');
			return;
		}

		if (!products.some((product) => product.id === productId)) {
			setProductId(products[0].id);
		}
	}, [productId, products]);

	useEffect(() => {
		if (!sourceOptions.some((option) => option.value === sourceValue)) {
			setSourceValue('central');
		}
	}, [sourceOptions, sourceValue]);

	useEffect(() => {
		if (outlets.length === 0) {
			setRows([{ id: createId(), outletId: '', qtyInput: '1' }]);
			return;
		}

		setRows((current) =>
			current.map((row) => ({
				...row,
				outletId: outlets.some((outlet) => outlet.id === row.outletId)
					? row.outletId
					: outlets[0].id,
			})),
		);
	}, [outlets]);

	const source: StockLocation =
		sourceValue === 'central'
			? { kind: 'central' }
			: { kind: 'outlet', outletId: sourceValue.replace('outlet:', '') };

	const sourceStock = productId ? getStockByLocation(productId, source) : 0;
	const selectedProduct = products.find((product) => product.id === productId);
	const selectedUnitLabel = selectedProduct
		? getProductUnitLabel(selectedProduct, unitNameById)
		: '-';

	return (
		<div className="space-y-4">
			<form
				className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
				onSubmit={(event) => {
					event.preventDefault();

					if (!productId) {
						return;
					}

					const success = onSubmit({
						productId,
						source,
						destinations: rows.map((row) => ({
							outletId: row.outletId,
							qty: parseIntegerInput(row.qtyInput, 0),
						})),
						note,
					});

					if (success) {
						setNote('');
						setRows([
							{
								id: createId(),
								outletId: outlets[0]?.id ?? '',
								qtyInput: '1',
							},
						]);
					}
				}}
			>
				<h2 className="text-lg font-semibold text-slate-900">
					Transfer Produk
				</h2>
				<p className="mt-1 text-sm text-slate-500">
					Transfer dapat dilakukan dari pusat ke banyak outlet, atau antar
					outlet.
				</p>

				<div className="mt-4 space-y-3">
					<SearchableOptionDropdown
						label="Sumber stok"
						options={sourceOptions}
						value={sourceValue}
						onChange={setSourceValue}
						buttonPlaceholder="Pilih sumber stok"
						searchPlaceholder="Cari sumber stok..."
						emptyText="Sumber stok tidak ditemukan."
					/>

					<SearchableOptionDropdown
						label="Produk"
						options={productOptions}
						value={productId}
						onChange={setProductId}
						buttonPlaceholder="Pilih produk"
						searchPlaceholder="Cari produk..."
						emptyText="Produk tidak ditemukan."
					/>

					<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
						<p className="text-[11px] uppercase tracking-wide text-slate-500">
							Stok sumber tersedia
						</p>
						<p className="text-lg font-bold text-slate-900">
							{sourceStock} {selectedUnitLabel}
						</p>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<p className="text-sm font-semibold text-slate-800">
								Outlet Tujuan
							</p>
							<button
								type="button"
								onClick={() =>
									setRows((current) => [
										...current,
										{
											id: createId(),
											outletId: outlets[0]?.id ?? '',
											qtyInput: '1',
										},
									])
								}
								className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
							>
								+ Tambah Tujuan
							</button>
						</div>

						{rows.map((row, index) => (
							<div
								key={row.id}
								className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"
							>
								<SearchableOptionDropdown
									options={destinationOptions}
									value={row.outletId}
									onChange={(nextOutletId) => {
										setRows((current) =>
											current.map((item) =>
												item.id === row.id
													? { ...item, outletId: nextOutletId }
													: item,
											),
										);
									}}
									buttonPlaceholder="Pilih outlet tujuan"
									searchPlaceholder="Cari outlet tujuan..."
									emptyText="Outlet tujuan tidak ditemukan."
									compact
								/>

								<input
									type="number"
									min={1}
									step={1}
									value={row.qtyInput}
									onChange={(event) => {
										const raw = event.target.value;
										setRows((current) =>
											current.map((item) =>
												item.id === row.id
													? {
															...item,
															qtyInput:
																raw === ''
																	? raw
																	: `${Math.max(0, parseIntegerInput(raw, 0))}`,
														}
													: item,
											),
										);
									}}
									className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
									required
								/>

								<button
									type="button"
									onClick={() => {
										if (rows.length === 1) {
											return;
										}
										setRows((current) =>
											current.filter((item) => item.id !== row.id),
										);
									}}
									className="rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700"
									disabled={rows.length === 1}
								>
									Hapus
								</button>

								<p className="sm:col-span-3 text-xs text-slate-500">
									Tujuan #{index + 1}
								</p>
							</div>
						))}
					</div>

					<label>
						<span className="mb-1 block text-sm font-medium text-slate-700">
							Catatan (opsional)
						</span>
						<input
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Contoh: Distribusi mingguan"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						/>
					</label>

					<button
						type="submit"
						className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
					>
						Simpan Transfer
					</button>
				</div>
			</form>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
					Log Transfer
				</h3>

				{transfers.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">
						Belum ada data transfer.
					</p>
				) : (
					<ul className="mt-4 space-y-3">
						{transfers.map((transfer) => {
							const transferUnitLabel =
								unitNameById[
									products.find((product) => product.id === transfer.productId)
										?.unitId ?? ''
								] ?? '-';

							return (
								<li
									key={transfer.id}
									className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
								>
								<p className="text-sm font-semibold text-slate-900">
									{transfer.productName}
								</p>
								<p className="text-xs text-slate-500">
									{new Date(transfer.createdAt).toLocaleString('id-ID')} |
									Sumber: {transfer.sourceLabel}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Total transfer: {transfer.totalQty} {transferUnitLabel}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Tujuan:{' '}
									{transfer.destinations
										.map(
											(destination) =>
												`${destination.outletName} (${destination.qty} ${transferUnitLabel})`,
										)
										.join(', ')}
								</p>
								<p className="mt-1 text-xs text-slate-500">
									Catatan: {transfer.note}
								</p>
								</li>
							);
						})}
					</ul>
				)}

				<PaginationControls
					totalItems={totalTransferItems}
					page={transferPage}
					pageSize={transferPageSize}
					totalPages={transferTotalPages}
					onChangePage={onChangePage}
					onChangePageSize={onChangePageSize}
				/>
			</div>
		</div>
	);
}

function StockOpnameForm({
	products,
	categories,
	unitNameById,
	outlets,
	favoritesByLocation,
	usageByLocation,
	getStockByLocation,
	onToggleFavorite,
	onSubmit,
}: {
	products: Product[];
	categories: Category[];
	unitNameById: Record<string, string>;
	outlets: Outlet[];
	favoritesByLocation: FavoriteState;
	usageByLocation: UsageState;
	getStockByLocation: (productId: string, location: StockLocation) => number;
	onToggleFavorite: (location: StockLocation, productId: string) => void;
	onSubmit: (payload: {
		productId: string;
		actualStock: number;
		note: string;
		location: StockLocation;
	}) => boolean;
}) {
	const [locationValue, setLocationValue] = useState('central');
	const [productId, setProductId] = useState(products[0]?.id ?? '');
	const [isInputModalOpen, setIsInputModalOpen] = useState(false);
	const [eventLines, setEventLines] = useState<string[] | null>(null);
	const locationOptions = useMemo(
		() => [
			{
				value: 'central',
				label: 'Pusat',
				description: 'Gudang pusat',
			},
			...outlets.map((outlet) => ({
				value: `outlet:${outlet.id}`,
				label: `${outlet.name} (${outlet.code})`,
				description: outlet.address,
			})),
		],
		[outlets],
	);

	const location: StockLocation =
		locationValue === 'central'
			? { kind: 'central' }
			: { kind: 'outlet', outletId: locationValue.replace('outlet:', '') };

	const locationKey = toLocationKey(location);
	const prioritizedProducts = useMemo(
		() =>
			prioritizeProducts(
				products,
				locationKey,
				favoritesByLocation,
				usageByLocation,
			),
		[products, locationKey, favoritesByLocation, usageByLocation],
	);
	const favoriteSet = new Set(favoritesByLocation[locationKey] ?? []);

	const selectedProduct = prioritizedProducts.find(
		(product) => product.id === productId,
	);
	const selectedUnitLabel = selectedProduct
		? getProductUnitLabel(selectedProduct, unitNameById)
		: '-';

	useEffect(() => {
		if (prioritizedProducts.length === 0) {
			setProductId('');
			return;
		}

		if (!prioritizedProducts.some((product) => product.id === productId)) {
			setProductId(prioritizedProducts[0].id);
		}
	}, [productId, prioritizedProducts]);

	useEffect(() => {
		if (!locationOptions.some((option) => option.value === locationValue)) {
			setLocationValue('central');
		}
	}, [locationOptions, locationValue]);

	const systemStock = selectedProduct
		? getStockByLocation(selectedProduct.id, location)
		: 0;
	const locationLabel = getLocationLabel(outlets, location);
	const selectedUsage = selectedProduct
		? (usageByLocation[locationKey]?.[selectedProduct.id] ?? 0)
		: 0;
	const isSelectedFavorite = selectedProduct
		? favoriteSet.has(selectedProduct.id)
		: false;

	if (products.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">
					Modul Stok Opname
				</h2>
				<p className="mt-2 text-sm text-slate-500">
					Belum ada produk. Tambahkan dari menu Produk.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Stok Opname</h2>
				<p className="mt-1 text-sm text-slate-500">
					Pilih lokasi dan produk, lalu lanjutkan input stok fisik di popup.
				</p>

				<div className="mt-4 space-y-3">
					<LocationSelectDropdown
						label="Lokasi"
						options={locationOptions}
						value={locationValue}
						onChange={setLocationValue}
					/>

					<ProductSelectDropdown
						label="Produk"
						products={prioritizedProducts}
						categories={categories}
						value={productId}
						onChange={setProductId}
						favoriteIds={favoritesByLocation[locationKey] ?? []}
						usageMap={usageByLocation[locationKey] ?? {}}
						onToggleFavorite={(targetProductId) =>
							onToggleFavorite(location, targetProductId)
						}
					/>

					{selectedProduct ? (
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
							<p className="text-xs text-slate-600">
								Dipakai {selectedUsage}x pada lokasi ini.
							</p>
							<button
								type="button"
								onClick={() => onToggleFavorite(location, selectedProduct.id)}
								className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
									isSelectedFavorite
										? 'bg-amber-100 text-amber-700'
										: 'bg-slate-200 text-slate-700'
								}`}
							>
								{isSelectedFavorite
									? 'Favorit lokasi'
									: 'Jadikan favorit lokasi'}
							</button>
						</div>
					) : null}

					<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
						<p className="text-[11px] uppercase tracking-wide text-slate-500">
							Stok Sistem
						</p>
						<p className="text-lg font-bold text-slate-900">
							{systemStock} {selectedUnitLabel}
						</p>
					</div>

					<button
						type="button"
						onClick={() => setIsInputModalOpen(true)}
						disabled={!selectedProduct}
						className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Lanjut Input Stok Opname
					</button>
				</div>
			</div>

			<OpnameInputModal
				isOpen={isInputModalOpen}
				product={selectedProduct ?? null}
				locationLabel={locationLabel}
				currentStock={systemStock}
				unitLabel={selectedUnitLabel}
				onClose={() => setIsInputModalOpen(false)}
				onSave={({ actualStock, note, delta }) => {
					if (!selectedProduct) {
						return;
					}

					const success = onSubmit({
						productId: selectedProduct.id,
						actualStock,
						note,
						location,
					});

					if (success) {
						setIsInputModalOpen(false);
						setEventLines([
							`Lokasi: ${locationLabel}`,
							`Produk: ${selectedProduct.name}`,
							`Stok sistem: ${systemStock} ${selectedUnitLabel}`,
							`Stok fisik: ${actualStock} ${selectedUnitLabel}`,
							`Penyesuaian: ${delta > 0 ? '+' : ''}${delta} ${selectedUnitLabel}`,
							`Catatan: ${note || 'Tanpa catatan'}`,
						]);
					}
				}}
			/>

			<EventResultModal
				isOpen={eventLines !== null}
				title="Stok Opname Tersimpan"
				tone="orange"
				lines={eventLines ?? []}
				onClose={() => setEventLines(null)}
			/>
		</>
	);
}

function SearchableOptionDropdown({
	label,
	options,
	value,
	onChange,
	buttonPlaceholder,
	searchPlaceholder,
	emptyText,
	compact = false,
}: {
	label?: string;
	options: Array<{ value: string; label: string; description?: string }>;
	value: string;
	onChange: (next: string) => void;
	buttonPlaceholder: string;
	searchPlaceholder: string;
	emptyText: string;
	compact?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const containerRef = useRef<HTMLDivElement | null>(null);

	const selectedOption = options.find((option) => option.value === value);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return options;
		}

		return options.filter((option) => {
			const text = `${option.label} ${option.description ?? ''}`.toLowerCase();
			return text.includes(normalizedQuery);
		});
	}, [options, query]);

	useEffect(() => {
		if (!isOpen) {
			setQuery('');
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current) {
				return;
			}

			if (
				event.target instanceof Node &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	const buttonClass = compact
		? 'flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2 text-left text-sm outline-none transition focus:border-slate-500'
		: 'flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm outline-none transition focus:border-slate-500';

	return (
		<div className="relative" ref={containerRef}>
			{label ? (
				<span className="mb-1 block text-sm font-medium text-slate-700">
					{label}
				</span>
			) : null}
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className={buttonClass}
			>
				<span className="block truncate text-slate-800">
					{selectedOption ? selectedOption.label : buttonPlaceholder}
				</span>
				<span className="ml-2 text-slate-500">v</span>
			</button>

			{isOpen ? (
				<div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchPlaceholder}
						className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>

					<ul className="max-h-56 space-y-1 overflow-y-auto">
						{filteredOptions.length === 0 ? (
							<li className="rounded-lg px-2 py-2 text-xs text-slate-500">
								{emptyText}
							</li>
						) : (
							filteredOptions.map((option) => {
								const isActive = option.value === value;

								return (
									<li key={option.value}>
										<button
											type="button"
											onClick={() => {
												onChange(option.value);
												setIsOpen(false);
											}}
											className={`w-full rounded-lg px-2 py-2 text-left ${
												isActive
													? 'bg-slate-900 text-white'
													: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
											}`}
										>
											<span className="block text-sm font-medium">
												{option.label}
											</span>
											{option.description ? (
												<span
													className={`block text-xs ${isActive ? 'text-slate-200' : 'text-slate-500'}`}
												>
													{option.description}
												</span>
											) : null}
										</button>
									</li>
								);
							})
						)}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function CategorySelectDropdown({
	categories,
	value,
	onChange,
	compact = false,
}: {
	categories: Category[];
	value: string;
	onChange: (next: string) => void;
	compact?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const containerRef = useRef<HTMLDivElement | null>(null);

	const selectedCategory = categories.find((category) => category.id === value);

	const filteredCategories = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return categories;
		}

		return categories.filter((category) =>
			category.name.toLowerCase().includes(normalizedQuery),
		);
	}, [categories, query]);

	useEffect(() => {
		if (!isOpen) {
			setQuery('');
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current) {
				return;
			}

			if (
				event.target instanceof Node &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	const buttonClass = compact
		? 'flex w-full items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-left text-sm outline-none transition focus:border-slate-500'
		: 'flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2 text-left text-sm outline-none transition focus:border-slate-500';

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className={buttonClass}
			>
				<span className="block truncate text-slate-800">
					{selectedCategory ? selectedCategory.name : 'Pilih kategori'}
				</span>
				<span className="ml-2 text-slate-500">v</span>
			</button>

			{isOpen ? (
				<div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Cari kategori..."
						className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>

					<ul className="max-h-56 space-y-1 overflow-y-auto">
						{filteredCategories.length === 0 ? (
							<li className="rounded-lg px-2 py-2 text-xs text-slate-500">
								Kategori tidak ditemukan.
							</li>
						) : (
							filteredCategories.map((category) => {
								const isActive = category.id === value;

								return (
									<li key={category.id}>
										<button
											type="button"
											onClick={() => {
												onChange(category.id);
												setIsOpen(false);
											}}
											className={`w-full rounded-lg px-2 py-2 text-left ${
												isActive
													? 'bg-slate-900 text-white'
													: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
											}`}
										>
											<span className="block text-sm font-medium">
												{category.name}
											</span>
										</button>
									</li>
								);
							})
						)}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function CategoryFilterDropdown({
	value,
	options,
	onChange,
}: {
	value: string;
	options: Array<{ value: string; label: string; description: string }>;
	onChange: (next: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const containerRef = useRef<HTMLDivElement | null>(null);

	const selectedOption = options.find((option) => option.value === value);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return options;
		}

		return options.filter((option) => {
			const text = `${option.label} ${option.description}`.toLowerCase();
			return text.includes(normalizedQuery);
		});
	}, [options, query]);

	useEffect(() => {
		if (!isOpen) {
			setQuery('');
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current) {
				return;
			}

			if (
				event.target instanceof Node &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-2.5 py-1.5 text-left text-xs outline-none transition focus:border-slate-500"
			>
				<span className="truncate text-slate-700">
					{selectedOption ? selectedOption.label : 'Semua kategori'}
				</span>
				<span className="ml-2 text-slate-500">v</span>
			</button>

			{isOpen ? (
				<div className="absolute right-0 z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Cari kategori..."
						className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>

					<ul className="max-h-56 space-y-1 overflow-y-auto">
						{filteredOptions.length === 0 ? (
							<li className="rounded-lg px-2 py-2 text-xs text-slate-500">
								Kategori tidak ditemukan.
							</li>
						) : (
							filteredOptions.map((option) => {
								const isActive = option.value === value;

								return (
									<li key={option.value}>
										<button
											type="button"
											onClick={() => {
												onChange(option.value);
												setIsOpen(false);
											}}
											className={`w-full rounded-lg px-2 py-2 text-left ${
												isActive
													? 'bg-slate-900 text-white'
													: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
											}`}
										>
											<span className="block text-sm font-medium">
												{option.label}
											</span>
											<span
												className={`block text-xs ${isActive ? 'text-slate-200' : 'text-slate-500'}`}
											>
												{option.description}
											</span>
										</button>
									</li>
								);
							})
						)}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function LocationSelectDropdown({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: Array<{ value: string; label: string; description: string }>;
	value: string;
	onChange: (next: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const containerRef = useRef<HTMLDivElement | null>(null);

	const selectedOption = options.find((option) => option.value === value);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return options;
		}

		return options.filter((option) => {
			const text = `${option.label} ${option.description}`.toLowerCase();
			return text.includes(normalizedQuery);
		});
	}, [options, query]);

	useEffect(() => {
		if (!isOpen) {
			setQuery('');
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current) {
				return;
			}

			if (
				event.target instanceof Node &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="relative" ref={containerRef}>
			<span className="mb-1 block text-sm font-medium text-slate-700">
				{label}
			</span>
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm outline-none transition focus:border-slate-500"
			>
				<span className="block truncate text-slate-800">
					{selectedOption ? selectedOption.label : 'Pilih lokasi'}
				</span>
				<span className="ml-3 text-slate-500">v</span>
			</button>

			{isOpen ? (
				<div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Cari lokasi..."
						className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>

					<ul className="max-h-56 space-y-1 overflow-y-auto">
						{filteredOptions.length === 0 ? (
							<li className="rounded-lg px-2 py-2 text-xs text-slate-500">
								Lokasi tidak ditemukan.
							</li>
						) : (
							filteredOptions.map((option) => {
								const isActive = option.value === value;

								return (
									<li key={option.value}>
										<button
											type="button"
											onClick={() => {
												onChange(option.value);
												setIsOpen(false);
											}}
											className={`w-full rounded-lg px-2 py-2 text-left ${
												isActive
													? 'bg-slate-900 text-white'
													: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
											}`}
										>
											<span className="block text-sm font-medium">
												{option.label}
											</span>
											<span
												className={`block text-xs ${isActive ? 'text-slate-200' : 'text-slate-500'}`}
											>
												{option.description}
											</span>
										</button>
									</li>
								);
							})
						)}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function ProductSelectDropdown({
	label,
	products,
	categories,
	value,
	onChange,
	favoriteIds,
	usageMap,
	onToggleFavorite,
}: {
	label: string;
	products: Product[];
	categories: Category[];
	value: string;
	onChange: (productId: string) => void;
	favoriteIds: string[];
	usageMap: Record<string, number>;
	onToggleFavorite: (productId: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const containerRef = useRef<HTMLDivElement | null>(null);

	const categoryMap = useMemo(
		() =>
			categories.reduce<Record<string, string>>((accumulator, category) => {
				accumulator[category.id] = category.name;
				return accumulator;
			}, {}),
		[categories],
	);

	const selectedProduct = products.find((product) => product.id === value);
	const favoriteSet = new Set(favoriteIds);

	const filteredProducts = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return products;
		}

		return products.filter((product) => {
			const name = product.name.toLowerCase();
			const sku = product.sku.toLowerCase();
			const category = (categoryMap[product.categoryId] ?? '').toLowerCase();
			return (
				name.includes(normalizedQuery) ||
				sku.includes(normalizedQuery) ||
				category.includes(normalizedQuery)
			);
		});
	}, [categoryMap, products, query]);

	useEffect(() => {
		if (!isOpen) {
			setQuery('');
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current) {
				return;
			}

			if (
				event.target instanceof Node &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="relative" ref={containerRef}>
			<span className="mb-1 block text-sm font-medium text-slate-700">
				{label}
			</span>
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm outline-none transition focus:border-slate-500"
			>
				<span className="block truncate text-slate-800">
					{selectedProduct
						? `${selectedProduct.name} (${selectedProduct.sku})`
						: 'Pilih produk'}
				</span>
				<span className="ml-3 text-slate-500">v</span>
			</button>

			{isOpen ? (
				<div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Cari produk / SKU / kategori"
						className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>

					<ul className="max-h-64 space-y-1 overflow-y-auto">
						{filteredProducts.length === 0 ? (
							<li className="rounded-lg px-2 py-2 text-xs text-slate-500">
								Produk tidak ditemukan.
							</li>
						) : (
							filteredProducts.map((product) => {
								const isSelected = product.id === value;
								const isFavorite = favoriteSet.has(product.id);
								const usageCount = usageMap[product.id] ?? 0;

								return (
									<li key={product.id}>
										<div
											className={`flex items-start gap-2 rounded-lg border px-2 py-2 ${
												isSelected
													? 'border-slate-900 bg-slate-900 text-white'
													: 'border-slate-200 bg-slate-50'
											}`}
										>
											<button
												type="button"
												onClick={() => {
													onChange(product.id);
													setIsOpen(false);
												}}
												className="flex-1 text-left"
											>
												<span className="block text-sm font-medium">
													{product.name}
												</span>
												<span
													className={`block text-xs ${
														isSelected ? 'text-slate-200' : 'text-slate-500'
													}`}
												>
													{product.sku} |{' '}
													{categoryMap[product.categoryId] ?? 'Tanpa kategori'}{' '}
													| Dipakai {usageCount}x
												</span>
											</button>

											<button
												type="button"
												onClick={() => onToggleFavorite(product.id)}
												className={`rounded px-2 py-1 text-sm ${
													isSelected
														? 'bg-white/10 text-white'
														: 'bg-white text-slate-700'
												}`}
												aria-label={
													isFavorite ? 'Hapus favorit' : 'Tambah favorit'
												}
											>
												{isFavorite ? '★' : '☆'}
											</button>
										</div>
									</li>
								);
							})
						)}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function MovementInputModal({
	isOpen,
	mode,
	product,
	locationLabel,
	currentStock,
	unitLabel,
	onClose,
	onSave,
}: {
	isOpen: boolean;
	mode: 'in' | 'out';
	product: Product | null;
	locationLabel: string;
	currentStock: number;
	unitLabel: string;
	onClose: () => void;
	onSave: (payload: {
		qty: number;
		note: string;
		projectedStock: number;
	}) => void;
}) {
	const [qtyInput, setQtyInput] = useState('1');
	const [note, setNote] = useState('');
	const qty = parseIntegerInput(qtyInput, 0);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setQtyInput('1');
		setNote('');
	}, [isOpen, mode, product?.id, locationLabel]);

	if (!isOpen || !product) {
		return null;
	}

	const projectedStock = currentStock + (mode === 'in' ? qty : -qty);
	const invalidOut = mode === 'out' && qty > currentStock;

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center">
			<div className="sheet-enter w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
				<div className="mb-2 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-slate-900">
						Input {mode === 'in' ? 'Stok Masuk' : 'Stok Keluar'}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
					>
						Tutup
					</button>
				</div>

				<p className="text-xs text-slate-500">
					{locationLabel} | {product.name} ({product.sku}) | Stok saat ini:{' '}
					{currentStock} {unitLabel}
				</p>

				<label className="mt-3 block">
					<span className="mb-1 block text-xs font-medium text-slate-700">
						Jumlah
					</span>
					<input
						type="number"
						min={1}
						step={1}
						value={qtyInput}
						onChange={(event) => {
							const raw = event.target.value;
							setQtyInput(raw);
							if (raw === '') {
								return;
							}
							setQtyInput(`${Math.max(0, parseIntegerInput(raw, 0))}`);
						}}
						className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>
				</label>

				<div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
					<p className="text-[11px] uppercase tracking-wide text-slate-500">
						Stok Setelah Simpan
					</p>
					<p
						className={`text-lg font-bold ${projectedStock < 0 ? 'text-red-600' : 'text-slate-900'}`}
					>
						{projectedStock} {unitLabel}
					</p>
					{invalidOut ? (
						<p className="mt-1 text-[11px] text-red-600">
							Jumlah melebihi stok tersedia. Tersedia: {currentStock}{' '}
							{unitLabel}.
						</p>
					) : null}
				</div>

				<label className="mt-3 block">
					<span className="mb-1 block text-xs font-medium text-slate-700">
						Catatan (opsional)
					</span>
					<textarea
						value={note}
						onChange={(event) => setNote(event.target.value)}
						rows={2}
						placeholder="Tulis catatan transaksi..."
						className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>
				</label>

				<button
					type="button"
					onClick={() => onSave({ qty, note: note.trim(), projectedStock })}
					disabled={qty <= 0 || invalidOut}
					className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
						mode === 'in'
							? 'bg-teal-600 hover:bg-teal-700'
							: 'bg-rose-600 hover:bg-rose-700'
					} disabled:cursor-not-allowed disabled:opacity-50`}
				>
					Simpan {mode === 'in' ? 'Stok Masuk' : 'Stok Keluar'}
				</button>
			</div>
		</div>
	);
}

function OpnameInputModal({
	isOpen,
	product,
	locationLabel,
	currentStock,
	unitLabel,
	onClose,
	onSave,
}: {
	isOpen: boolean;
	product: Product | null;
	locationLabel: string;
	currentStock: number;
	unitLabel: string;
	onClose: () => void;
	onSave: (payload: {
		actualStock: number;
		note: string;
		delta: number;
	}) => void;
}) {
	const [actualStockInput, setActualStockInput] = useState('0');
	const [note, setNote] = useState('');
	const actualStock = parseIntegerInput(actualStockInput, 0);

	useEffect(() => {
		if (!isOpen || !product) {
			return;
		}

		setActualStockInput(`${currentStock}`);
		setNote('');
	}, [isOpen, product?.id, currentStock, locationLabel]);

	if (!isOpen || !product) {
		return null;
	}

	const delta = actualStock - currentStock;

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center">
			<div className="sheet-enter w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
				<div className="mb-2 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-slate-900">
						Input Stok Opname
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
					>
						Tutup
					</button>
				</div>

				<p className="text-xs text-slate-500">
					{locationLabel} | {product.name} ({product.sku}) | Stok sistem:{' '}
					{currentStock} {unitLabel}
				</p>

				<label className="mt-3 block">
					<span className="mb-1 block text-xs font-medium text-slate-700">
						Stok Fisik
					</span>
					<input
						type="number"
						min={0}
						step={1}
						value={actualStockInput}
						onChange={(event) => {
							const raw = event.target.value;
							setActualStockInput(raw);
							if (raw === '') {
								return;
							}
							setActualStockInput(`${Math.max(0, parseIntegerInput(raw, 0))}`);
						}}
						className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>
				</label>

				<div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
					<p className="text-[11px] uppercase tracking-wide text-slate-500">
						Penyesuaian
					</p>
					<p
						className={`text-lg font-bold ${
							delta > 0
								? 'text-emerald-600'
								: delta < 0
									? 'text-orange-600'
									: 'text-slate-700'
						}`}
					>
						{delta > 0 ? `+${delta}` : `${delta}`} {unitLabel}
					</p>
				</div>

				<label className="mt-3 block">
					<span className="mb-1 block text-xs font-medium text-slate-700">
						Catatan (opsional)
					</span>
					<textarea
						value={note}
						onChange={(event) => setNote(event.target.value)}
						rows={2}
						placeholder="Tulis catatan opname..."
						className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
					/>
				</label>

				<button
					type="button"
					onClick={() => onSave({ actualStock, note: note.trim(), delta })}
					disabled={actualStock < 0}
					className="mt-3 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Simpan Stok Opname
				</button>
			</div>
		</div>
	);
}

function EventResultModal({
	isOpen,
	title,
	tone,
	lines,
	onClose,
}: {
	isOpen: boolean;
	title: string;
	tone: 'teal' | 'red' | 'orange';
	lines: string[];
	onClose: () => void;
}) {
	if (!isOpen) {
		return null;
	}

	const toneClass =
		tone === 'teal'
			? 'bg-teal-600 hover:bg-teal-700'
			: tone === 'red'
				? 'bg-rose-600 hover:bg-rose-700'
				: 'bg-orange-500 hover:bg-orange-600';

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center">
			<div className="sheet-enter w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
				<h3 className="text-sm font-semibold text-slate-900">{title}</h3>

				<ul className="mt-2 space-y-1.5">
					{lines.map((line, index) => (
						<li
							key={`${line}-${index}`}
							className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
						>
							{line}
						</li>
					))}
				</ul>

				<button
					type="button"
					onClick={onClose}
					className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${toneClass}`}
				>
					OK
				</button>
			</div>
		</div>
	);
}

function SkuGeneratingModal({ isOpen }: { isOpen: boolean }) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center">
			<div className="sheet-enter w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-2xl">
				<div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
				<p className="mt-3 text-sm font-semibold text-slate-900">
					Sedang memproses...
				</p>
				<p className="mt-1 text-xs text-slate-500">
					Generate SKU berdasarkan nama produk
				</p>
			</div>
		</div>
	);
}

function PaginationControls({
	totalItems,
	page,
	pageSize,
	totalPages,
	onChangePage,
	onChangePageSize,
}: {
	totalItems: number;
	page: number;
	pageSize: PageSize;
	totalPages: number;
	onChangePage: (page: number) => void;
	onChangePageSize: (size: PageSize) => void;
}) {
	return (
		<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
			<p>
				Total {totalItems} data | Halaman {page} dari {totalPages}
			</p>

			<div className="flex flex-wrap items-center gap-2">
				<select
					value={pageSize}
					onChange={(event) =>
						onChangePageSize(Number(event.target.value) as PageSize)
					}
					className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none transition focus:border-slate-500"
				>
					{PAGE_SIZE_OPTIONS.map((option) => (
						<option key={option} value={option}>
							{option} / halaman
						</option>
					))}
				</select>

				<button
					type="button"
					onClick={() => onChangePage(Math.max(1, page - 1))}
					disabled={page <= 1}
					className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
				>
					Sebelumnya
				</button>

				<span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
					{page}
				</span>

				<button
					type="button"
					onClick={() => onChangePage(Math.min(totalPages, page + 1))}
					disabled={page >= totalPages}
					className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
				>
					Berikutnya
				</button>
			</div>
		</div>
	);
}

function MoreMenuDialog({
	isOpen,
	activeTab,
	tone,
	showActive,
	onClose,
	onSelect,
}: {
	isOpen: boolean;
	activeTab: MoreTab;
	tone: PageTone;
	showActive: boolean;
	onClose: () => void;
	onSelect: (tab: MoreTab) => void;
}) {
	const tabs: { key: MoreTab; label: string; desc: string }[] = [
		{
			key: 'history',
			label: 'Riwayat',
			desc: 'Pergerakan stok masuk, keluar, opname',
		},
		{
			key: 'master',
			label: 'Master',
			desc: 'Kelola produk, kategori, dan satuan',
		},
		{
			key: 'outlets',
			label: 'Outlet',
			desc: 'Kelola outlet dan titik koordinat',
		},
		{
			key: 'transfer',
			label: 'Transfer',
			desc: 'Transfer produk antar lokasi',
		},
		{
			key: 'opname',
			label: 'Opname',
			desc: 'Penyesuaian stok fisik',
		},
		{
			key: 'analytics',
			label: 'Analitik Stok',
			desc: 'Laporan data barang dan tren stok',
		},
		{
			key: 'export',
			label: 'Ekspor Data',
			desc: 'Ekspor snapshot stok ke Excel',
		},
	];

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-40 sm:hidden">
			<button
				type="button"
				aria-label="Tutup menu lainnya"
				className="absolute inset-0 bg-slate-900/20"
				onClick={onClose}
			/>

			<div className="pointer-events-none absolute inset-x-0 bottom-24 px-3">
				<div className="sheet-enter pointer-events-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-xs uppercase tracking-wide text-slate-500">
							Modul Lainnya
						</p>
						<button
							type="button"
							onClick={onClose}
							className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
						>
							Tutup
						</button>
					</div>

					<ul className="space-y-2">
						{tabs.map((tab) => {
							const isActive = showActive && activeTab === tab.key;

							return (
								<li key={tab.key}>
									<button
										type="button"
										onClick={() => onSelect(tab.key)}
										className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left ${
											isActive
												? PAGE_TONE_STYLES[tone].dialogActive
												: 'border-slate-200 bg-slate-50 text-slate-800'
										}`}
									>
										<span>
											<span className="block text-sm font-semibold">
												{tab.label}
											</span>
											<span
												className={`block text-xs ${
													isActive
														? PAGE_TONE_STYLES[tone].dialogActiveText
														: 'text-slate-500'
												}`}
											>
												{tab.desc}
											</span>
										</span>
										<span className="text-sm font-bold">&gt;</span>
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</div>
	);
}

function ToastMessage({ tone, message }: { tone: ToastTone; message: string }) {
	return (
		<div className="pointer-events-none fixed right-4 top-4 z-[70]">
			<div
				className={`toast-enter rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${
					tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
				}`}
			>
				{message}
			</div>
		</div>
	);
}

function movementBadgeClass(type: MovementType) {
	if (type === 'in') {
		return 'bg-emerald-100 text-emerald-700';
	}

	if (type === 'out') {
		return 'bg-orange-100 text-orange-700';
	}

	return 'bg-indigo-100 text-indigo-700';
}

function movementLabel(movement: Movement, unitLabel: string) {
	if (movement.type === 'opname') {
		if (movement.delta === 0) {
			return 'OPNAME 0';
		}
		return `OPNAME ${movement.delta > 0 ? '+' : ''}${movement.delta}`;
	}

	return `${movement.type === 'in' ? '+' : '-'}${movement.qty} ${unitLabel}`;
}

function createId() {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
