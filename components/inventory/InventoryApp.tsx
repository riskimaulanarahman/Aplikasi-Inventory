'use client';

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from 'react';
import BottomNav from '@/components/BottomNav';
import Dashboard from '@/components/inventory/dashboard/Dashboard';
import DesktopTabs from '@/components/inventory/layout/DesktopTabs';
import MoreMenuDialog from '@/components/inventory/layout/MoreMenuDialog';
import ToastMessage from '@/components/inventory/layout/ToastMessage';
import MovementForm from '@/components/inventory/movement/MovementForm';
import MoreContent from '@/components/inventory/more/MoreContent';
import TopBarProfile from '@/components/inventory/layout/TopBarProfile';
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
import { PAGE_TONE_STYLES } from '@/components/inventory/constants';
import {
	HistoryFilter,
	MasterTab,
	MoreTab,
	PageSize,
	PageTone,
	ReportTab,
	TabKey,
	ToastState,
	ToastTone,
} from '@/components/inventory/types';
import { getLocationLabel, toLocationKey } from '@/components/inventory/utils/location';
import { buildInitialUsage } from '@/components/inventory/utils/product';
import { getOutletStock, upsertOutletStock } from '@/components/inventory/utils/stock';

const TAB_QUERY_KEY = 'tab';
const MORE_TAB_QUERY_KEY = 'moreTab';
const MASTER_TAB_QUERY_KEY = 'masterTab';
const REPORT_TAB_QUERY_KEY = 'reportTab';
const DEFAULT_TAB: TabKey = 'dashboard';
const DEFAULT_MORE_TAB: MoreTab = 'history';
const DEFAULT_MASTER_TAB: MasterTab = 'products';
const DEFAULT_REPORT_TAB: ReportTab = 'analytics';

interface NavigationState {
	tab: TabKey;
	moreTab: MoreTab;
	masterTab: MasterTab;
	reportTab: ReportTab;
}

interface InventoryAppProps {
	initialNavigation?: NavigationState;
}

function isValidTabKey(value: string | null): value is TabKey {
	return value === 'dashboard' || value === 'in' || value === 'out' || value === 'more';
}

function isValidMoreTab(value: string | null): value is MoreTab {
	return (
		value === 'history' ||
		value === 'master' ||
		value === 'transfer' ||
		value === 'opname' ||
		value === 'report'
	);
}

function isValidMasterTab(value: string | null): value is MasterTab {
	return (
		value === 'products' ||
		value === 'categories' ||
		value === 'units' ||
		value === 'outlets'
	);
}

function isValidReportTab(value: string | null): value is ReportTab {
	return value === 'analytics' || value === 'export' || value === 'item-report';
}

function resolveNavigationState(search: string): NavigationState {
	const params = new URLSearchParams(search);
	const tabParam = params.get(TAB_QUERY_KEY);
	const moreTabParam = params.get(MORE_TAB_QUERY_KEY);
	const masterTabParam = params.get(MASTER_TAB_QUERY_KEY);
	const reportTabParam = params.get(REPORT_TAB_QUERY_KEY);

	const tab = isValidTabKey(tabParam) ? tabParam : DEFAULT_TAB;
	const moreTab = isValidMoreTab(moreTabParam) ? moreTabParam : DEFAULT_MORE_TAB;
	const masterTab = isValidMasterTab(masterTabParam)
		? masterTabParam
		: DEFAULT_MASTER_TAB;
	const reportTab = isValidReportTab(reportTabParam)
		? reportTabParam
		: DEFAULT_REPORT_TAB;

	return {
		tab,
		moreTab,
		masterTab,
		reportTab,
	};
}

function isNormalizedNavigation(search: string, state: NavigationState): boolean {
	const params = new URLSearchParams(search);

	const currentTab = params.get(TAB_QUERY_KEY);
	if (state.tab === DEFAULT_TAB) {
		if (currentTab !== null) {
			return false;
		}
	} else if (currentTab !== state.tab) {
		return false;
	}

	const currentMoreTab = params.get(MORE_TAB_QUERY_KEY);
	if (state.tab !== 'more' || state.moreTab === DEFAULT_MORE_TAB) {
		if (currentMoreTab !== null) {
			return false;
		}
	} else if (currentMoreTab !== state.moreTab) {
		return false;
	}

	const currentMasterTab = params.get(MASTER_TAB_QUERY_KEY);
	if (state.tab !== 'more' || state.moreTab !== 'master' || state.masterTab === DEFAULT_MASTER_TAB) {
		if (currentMasterTab !== null) {
			return false;
		}
	} else if (currentMasterTab !== state.masterTab) {
		return false;
	}

	const currentReportTab = params.get(REPORT_TAB_QUERY_KEY);
	if (state.tab !== 'more' || state.moreTab !== 'report' || state.reportTab === DEFAULT_REPORT_TAB) {
		if (currentReportTab !== null) {
			return false;
		}
	} else if (currentReportTab !== state.reportTab) {
		return false;
	}

	return true;
}

function buildUrlWithNavigation(state: NavigationState): string {
	const params = new URLSearchParams(window.location.search);

	if (state.tab === DEFAULT_TAB) {
		params.delete(TAB_QUERY_KEY);
	} else {
		params.set(TAB_QUERY_KEY, state.tab);
	}

	if (state.tab !== 'more' || state.moreTab === DEFAULT_MORE_TAB) {
		params.delete(MORE_TAB_QUERY_KEY);
	} else {
		params.set(MORE_TAB_QUERY_KEY, state.moreTab);
	}

	if (state.tab !== 'more' || state.moreTab !== 'master' || state.masterTab === DEFAULT_MASTER_TAB) {
		params.delete(MASTER_TAB_QUERY_KEY);
	} else {
		params.set(MASTER_TAB_QUERY_KEY, state.masterTab);
	}

	if (state.tab !== 'more' || state.moreTab !== 'report' || state.reportTab === DEFAULT_REPORT_TAB) {
		params.delete(REPORT_TAB_QUERY_KEY);
	} else {
		params.set(REPORT_TAB_QUERY_KEY, state.reportTab);
	}

	const query = params.toString();
	return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
}

export default function InventoryApp({ initialNavigation }: InventoryAppProps) {
	const [categories, setCategories] = useState<Category[]>(initialCategories);
	const [units, setUnits] = useState<Unit[]>(initialUnits);
	const [products, setProducts] = useState<Product[]>(initialProducts);
	const [outlets, setOutlets] = useState<Outlet[]>(initialOutlets);
	const [outletStocks, setOutletStocks] =
		useState<OutletStockRecord[]>(initialOutletStocks);
	const [movements, setMovements] = useState<Movement[]>(initialMovements);
	const [transfers, setTransfers] =
		useState<TransferRecord[]>(initialTransfers);
	const [activeTab, setActiveTab] = useState<TabKey>(
		initialNavigation?.tab ?? DEFAULT_TAB,
	);
	const [activeMoreTab, setActiveMoreTab] = useState<MoreTab>(
		initialNavigation?.moreTab ?? DEFAULT_MORE_TAB,
	);
	const [activeMasterTab, setActiveMasterTab] = useState<MasterTab>(
		initialNavigation?.masterTab ?? DEFAULT_MASTER_TAB,
	);
	const [activeReportTab, setActiveReportTab] = useState<ReportTab>(
		initialNavigation?.reportTab ?? DEFAULT_REPORT_TAB,
	);
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
	const [, startTransition] = useTransition();

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
		() =>
			products.filter(
				(product) => product.stock <= product.minimumLowStock,
			).length,
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
		if (typeof window === 'undefined') {
			return;
		}

		const nextUrl = buildUrlWithNavigation({
			tab: activeTab,
			moreTab: activeMoreTab,
			masterTab: activeMasterTab,
			reportTab: activeReportTab,
		});
		const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (nextUrl !== currentUrl) {
			window.history.replaceState(null, '', nextUrl);
		}
	}, [activeMasterTab, activeMoreTab, activeReportTab, activeTab]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const handlePopState = () => {
			const nextState = resolveNavigationState(window.location.search);
			setActiveTab(nextState.tab);
			setActiveMoreTab(nextState.moreTab);
			setActiveMasterTab(nextState.masterTab);
			setActiveReportTab(nextState.reportTab);

			if (!isNormalizedNavigation(window.location.search, nextState)) {
				const normalizedUrl = buildUrlWithNavigation(nextState);
				window.history.replaceState(null, '', normalizedUrl);
			}
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

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
		startTransition(() => {
			setActiveTab('more');
			setActiveMoreTab(tab);
		});
	};

	const openMoreDialog = () => {
		setError('');
		setIsProfileMenuOpen(false);
		setIsMoreMenuOpen(true);
	};

	const selectMoreDialogItem = (tab: MoreTab) => {
		setError('');
		setIsProfileMenuOpen(false);
		startTransition(() => {
			setActiveMoreTab(tab);
			setActiveTab('more');
		});
		setIsMoreMenuOpen(false);
	};

	const handleMainTabChange = (tab: TabKey) => {
		setError('');
		setIsMoreMenuOpen(false);
		setIsProfileMenuOpen(false);
		startTransition(() => {
			setActiveTab(tab);
		});
	};

	const handleMoreTabChange = (tab: MoreTab) => {
		startTransition(() => {
			setActiveMoreTab(tab);
		});
	};

	const handleMasterTabChange = (tab: MasterTab) => {
		startTransition(() => {
			setActiveMasterTab(tab);
		});
	};

	const handleReportTabChange = (tab: ReportTab) => {
		startTransition(() => {
			setActiveReportTab(tab);
		});
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
		minimumLowStock,
		categoryId,
		unitId,
	}: {
		name: string;
		sku: string;
		initialStock: number;
		minimumLowStock: number;
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
		if (!Number.isInteger(minimumLowStock) || minimumLowStock < 0) {
			markError(
				'Minimum stok rendah harus bilangan bulat dan tidak boleh negatif.',
			);
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
			minimumLowStock,
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
		minimumLowStock,
		categoryId,
		unitId,
	}: {
		productId: string;
		name: string;
		sku: string;
		minimumLowStock: number;
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
		if (!Number.isInteger(minimumLowStock) || minimumLowStock < 0) {
			markError(
				'Minimum stok rendah harus bilangan bulat dan tidak boleh negatif.',
			);
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
							minimumLowStock,
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

				<div>
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
							onChangeTab={handleMoreTabChange}
							onOpenMenu={openMoreDialog}
							movements={pagedMovements}
							movementTotal={filteredMovements.length}
							movementPage={Math.min(historyPage, historyTotalPages)}
							movementPageSize={historyPageSize}
							movementTotalPages={historyTotalPages}
							historyFilter={historyFilter}
							activeMasterTab={activeMasterTab}
							onChangeHistoryFilter={setHistoryFilter}
							onChangeMasterTab={handleMasterTabChange}
							activeReportTab={activeReportTab}
							onChangeReportTab={handleReportTabChange}
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

function createId() {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
