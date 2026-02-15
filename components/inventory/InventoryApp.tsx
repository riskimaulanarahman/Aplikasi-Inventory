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
import ProfileDialog from '@/components/inventory/layout/ProfileDialog';
import BillingDialog from '@/components/inventory/layout/BillingDialog';
import ToastMessage from '@/components/inventory/layout/ToastMessage';
import MovementForm from '@/components/inventory/movement/MovementForm';
import MoreContent from '@/components/inventory/more/MoreContent';
import TopBarProfile from '@/components/inventory/layout/TopBarProfile';
import {
	Category,
	FavoriteState,
	LocationKey,
	Movement,
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
	HistoryPeriod,
	LocationFilter,
	MasterTab,
	MoreTab,
	PageSize,
	PageTone,
	ReportTab,
	TabKey,
	ToastState,
	ToastTone,
} from '@/components/inventory/types';
import { toLocationKey } from '@/components/inventory/utils/location';
import { buildInitialUsage } from '@/components/inventory/utils/product';
import { getOutletStock } from '@/components/inventory/utils/stock';
import { clientApiFetch } from '@/lib/api/client';
import { changeMyPassword, updateMyProfile } from '@/lib/auth/client';
import type { CurrentUserSession } from '@/lib/auth/session';
import { clearClientAuthToken } from '@/lib/auth/token.client';
import {
	createCategory,
	createOutlet,
	createProduct,
	createUnit,
	deleteCategory,
	deleteOutlet,
	deleteProduct,
	deleteUnit,
	getInventorySnapshot,
	submitMovement,
	submitOpname,
	submitTransfer,
	updateCategory,
	updateOutlet,
	updateProduct,
	updateUnit,
} from '@/lib/inventory/client';
import type { MembershipRole } from '@/lib/tenant/context';
import {
	createTenantStaff,
	deactivateTenantStaff,
	getTenantStaff,
	resetTenantStaffPassword,
	type TenantStaffItem,
	updateTenantStaff,
} from '@/lib/tenant/client';

const TAB_QUERY_KEY = 'tab';
const MORE_TAB_QUERY_KEY = 'moreTab';
const MASTER_TAB_QUERY_KEY = 'masterTab';
const REPORT_TAB_QUERY_KEY = 'reportTab';
const DEFAULT_TAB: TabKey = 'dashboard';
const DEFAULT_MORE_TAB: MoreTab = 'history';
const DEFAULT_MASTER_TAB: MasterTab = 'products';
const DEFAULT_REPORT_TAB: ReportTab = 'analytics';
const DEFAULT_HISTORY_PERIOD: HistoryPeriod = 'last7days';

function toDateInputValue(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function parseDateInputToParts(value: string) {
	const parts = value.split('-');
	if (parts.length !== 3) {
		return null;
	}

	const year = Number(parts[0]);
	const month = Number(parts[1]);
	const day = Number(parts[2]);

	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	) {
		return null;
	}

	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}

	return { year, month, day };
}

function parseDateInputToStartMs(value: string) {
	const parsed = parseDateInputToParts(value);
	if (!parsed) {
		return null;
	}
	return new Date(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0).getTime();
}

function parseDateInputToEndMs(value: string) {
	const parsed = parseDateInputToParts(value);
	if (!parsed) {
		return null;
	}
	return new Date(
		parsed.year,
		parsed.month - 1,
		parsed.day,
		23,
		59,
		59,
		999,
	).getTime();
}

interface NavigationState {
	tab: TabKey;
	moreTab: MoreTab;
	masterTab: MasterTab;
	reportTab: ReportTab;
}

interface InventoryAppProps {
	initialNavigation?: NavigationState;
	headerLabel: string;
	headerTitle: string;
	tenantSlug: string;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
	currentUserSession: CurrentUserSession;
	isReadOnly?: boolean;
	subscriptionStatus?: string | null;
	trialEndAt?: string | null;
}

function getMembershipRoleLabel(role: MembershipRole): string {
	if (role === 'tenant_owner') {
		return 'Owner';
	}
	if (role === 'tenant_admin') {
		return 'Admin';
	}
	return 'Staff';
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
		value === 'outlets' ||
		value === 'staff'
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

export default function InventoryApp({
	initialNavigation,
	headerLabel,
	headerTitle,
	tenantSlug,
	membershipRole,
	accessibleBranchIds,
	currentUserSession,
	isReadOnly = false,
	subscriptionStatus = null,
	trialEndAt = null,
}: InventoryAppProps) {
	const canManageStaff = membershipRole === 'tenant_owner';
	const [profileDisplayName, setProfileDisplayName] = useState(
		currentUserSession.profile.displayName?.trim() || currentUserSession.user.name,
	);
	const [profilePhone, setProfilePhone] = useState(currentUserSession.profile.phone ?? '');
	const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
	const [profileFormDisplayName, setProfileFormDisplayName] = useState(profileDisplayName);
	const [profileFormPhone, setProfileFormPhone] = useState(profilePhone);
	const [newPassword, setNewPassword] = useState('');
	const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isChangingPassword, setIsChangingPassword] = useState(false);
	const [staffMembers, setStaffMembers] = useState<TenantStaffItem[]>([]);
	const [staffLoading, setStaffLoading] = useState(false);
	const [staffError, setStaffError] = useState('');
	const [staffLoaded, setStaffLoaded] = useState(false);

	const [categories, setCategories] = useState<Category[]>([]);
	const [units, setUnits] = useState<Unit[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [outlets, setOutlets] = useState<Outlet[]>([]);
	const [outletStocks, setOutletStocks] =
		useState<OutletStockRecord[]>([]);
	const [movements, setMovements] = useState<Movement[]>([]);
	const [transfers, setTransfers] =
		useState<TransferRecord[]>([]);
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
	const [analyticsLocationPreset, setAnalyticsLocationPreset] =
		useState<LocationFilter | null>(null);
	const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
	const [historySearchQuery, setHistorySearchQuery] = useState('');
	const [historyPeriod, setHistoryPeriod] =
		useState<HistoryPeriod>(DEFAULT_HISTORY_PERIOD);
	const [historyCustomStartDate, setHistoryCustomStartDate] = useState(() =>
		toDateInputValue(new Date()),
	);
	const [historyCustomEndDate, setHistoryCustomEndDate] = useState(() =>
		toDateInputValue(new Date()),
	);
	const [error, setError] = useState('');
	const [toast, setToast] = useState<ToastState | null>(null);
	const [eventPulse, setEventPulse] = useState(false);
	const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
	const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
	const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);
	const [favoritesByLocation, setFavoritesByLocation] = useState<FavoriteState>(
		{
			central: [],
		},
	);
	const [usageByLocation, setUsageByLocation] = useState<UsageState>(
		buildInitialUsage([]),
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
	const productSkuById = useMemo(() => {
		return products.reduce<Record<string, string>>((accumulator, product) => {
			accumulator[product.id] = product.sku;
			return accumulator;
		}, {});
	}, [products]);

	const accessibleMovements = useMemo(() => {
		if (membershipRole !== 'staff') return movements;
		const hasCentralAccess = outlets.some(
			(o) => o.code === 'PST' && accessibleBranchIds.includes(o.id),
		);
		return movements.filter((m) => {
			if (m.locationKind === 'central') return hasCentralAccess;
			return accessibleBranchIds.includes(m.locationId || '');
		});
	}, [membershipRole, movements, outlets, accessibleBranchIds]);

	const accessibleOutletStocks = useMemo(() => {
		if (membershipRole !== 'staff') return outletStocks;
		return outletStocks.filter((s) => accessibleBranchIds.includes(s.outletId));
	}, [membershipRole, outletStocks, accessibleBranchIds]);

	const accessibleTransfers = useMemo(() => {
		if (membershipRole !== 'staff') return transfers;
		// Staff can see transfers where they are source OR destination
		// Wait, user says "show only what is assigned to that staff"
		// If they send FROM central to an outlet they don't own, should they see it?
		// Usually yes, if they initiated it.
		// For simplicity, let's filter by source branch access.
		return transfers.filter((t) => {
			if (t.sourceKind === 'central') {
				const hasCentralAccess = outlets.some(
					(o) => o.code === 'PST' && accessibleBranchIds.includes(o.id),
				);
				return hasCentralAccess;
			}
			return accessibleBranchIds.includes(t.sourceOutletId || '');
		});
	}, [membershipRole, transfers, outlets, accessibleBranchIds]);

	const filteredMovements = useMemo(() => {
		const normalizedHistorySearchQuery = historySearchQuery
			.trim()
			.toLocaleLowerCase('id');
		const now = new Date();
		const nowMs = now.getTime();
		const startOfTodayMs = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			0,
			0,
			0,
			0,
		).getTime();

		let startMs = Number.NEGATIVE_INFINITY;
		let endMs = nowMs;

		if (historyPeriod === 'today') {
			startMs = startOfTodayMs;
		} else if (historyPeriod === 'last7days') {
			startMs = startOfTodayMs - 6 * 24 * 60 * 60 * 1000;
		} else if (historyPeriod === 'last30days') {
			startMs = startOfTodayMs - 29 * 24 * 60 * 60 * 1000;
		} else {
			const customStartMs = parseDateInputToStartMs(historyCustomStartDate);
			const customEndMs = parseDateInputToEndMs(historyCustomEndDate);
			startMs = customStartMs ?? Number.NEGATIVE_INFINITY;
			endMs = customEndMs ?? Number.POSITIVE_INFINITY;

			if (startMs > endMs) {
				const swappedStartMs = endMs;
				endMs = startMs;
				startMs = swappedStartMs;
			}
		}

		return accessibleMovements.filter((movement) => {
			if (historyFilter !== 'all' && movement.type !== historyFilter) {
				return false;
			}

			if (normalizedHistorySearchQuery) {
				const searchableText = `${movement.productName} ${productSkuById[movement.productId] ?? ''}`
					.toLocaleLowerCase('id');
				if (!searchableText.includes(normalizedHistorySearchQuery)) {
					return false;
				}
			}

			const createdAtMs = new Date(movement.createdAt).getTime();
			if (!Number.isFinite(createdAtMs)) {
				return false;
			}

			return createdAtMs >= startMs && createdAtMs <= endMs;
		});
	}, [
			historyCustomEndDate,
			historyCustomStartDate,
			historyFilter,
			historyPeriod,
			movements,
			productSkuById,
			historySearchQuery,
		]);

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
		Math.ceil(accessibleTransfers.length / transferPageSize),
	);

	const pagedTransfers = useMemo(() => {
		const safePage = Math.min(transferPage, transferTotalPages);
		const start = (safePage - 1) * transferPageSize;
		return accessibleTransfers.slice(start, start + transferPageSize);
	}, [transferPage, transferPageSize, transferTotalPages, accessibleTransfers]);

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
		setStaffMembers([]);
		setStaffError('');
		setStaffLoaded(false);
	}, [tenantSlug]);

	useEffect(() => {
		const nextDisplayName =
			currentUserSession.profile.displayName?.trim() || currentUserSession.user.name;
		const nextPhone = currentUserSession.profile.phone ?? '';

		setProfileDisplayName(nextDisplayName);
		setProfilePhone(nextPhone);
		setProfileFormDisplayName(nextDisplayName);
		setProfileFormPhone(nextPhone);
	}, [
		currentUserSession.profile.displayName,
		currentUserSession.profile.phone,
		currentUserSession.user.name,
	]);

	useEffect(() => {
		if (canManageStaff) {
			return;
		}

		if (activeTab === 'more' && activeMoreTab === 'master' && activeMasterTab === 'staff') {
			setActiveMasterTab('products');
		}
	}, [activeMasterTab, activeMoreTab, activeTab, canManageStaff]);

	useEffect(() => {
		setHistoryPage(1);
	}, [
		historyCustomEndDate,
		historyCustomStartDate,
		historyFilter,
		historySearchQuery,
		historyPageSize,
		historyPeriod,
	]);

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

	const ensureWritable = () => {
		if (!isReadOnly) {
			return true;
		}
		markError(
			'Mode read-only aktif. Trial/langganan belum aktif, aksi perubahan data diblokir.',
		);
		return false;
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
		if (tab === 'staff' && !canManageStaff) {
			startTransition(() => {
				setActiveMasterTab('products');
			});
			return;
		}

		startTransition(() => {
			setActiveMasterTab(tab);
		});
	};

	const handleReportTabChange = (tab: ReportTab) => {
		startTransition(() => {
			setActiveReportTab(tab);
		});
	};

	const openReportFromDashboard = (
		reportTab: ReportTab = 'analytics',
		locationFilter?: LocationFilter,
	) => {
		setError('');
		setIsMoreMenuOpen(false);
		setIsProfileMenuOpen(false);
		setAnalyticsLocationPreset(locationFilter ?? null);
		startTransition(() => {
			setActiveTab('more');
			setActiveMoreTab('report');
			setActiveReportTab(reportTab);
		});
	};

	const handleProfileClick = () => {
		setIsProfileMenuOpen(false);
		setProfileFormDisplayName(profileDisplayName);
		setProfileFormPhone(profilePhone);
		setNewPassword('');
		setNewPasswordConfirmation('');
		setIsProfileDialogOpen(true);
	};

	const handleLogoutClick = async () => {
		setIsProfileMenuOpen(false);
		try {
			await clientApiFetch('/api/auth/logout', {
				method: 'POST',
			});
		} finally {
			clearClientAuthToken();
			if (typeof window !== 'undefined') {
				window.location.assign('/login');
			}
		}
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

	const normalizeErrorMessage = (error: unknown, fallback: string): string => {
		if (error instanceof Error && error.message.trim() !== '') {
			const msg = error.message;
			// Map common Laravel validation messages to friendly ones
			if (msg.toLowerCase().includes('branch ids field is required')) {
				return 'Silakan pilih minimal satu outlet untuk memberikan akses kepada staff.';
			}
			if (msg.toLowerCase().includes('email has already been taken')) {
				return 'Email ini sudah terdaftar. Silakan gunakan email lain.';
			}
			return msg;
		}
		return fallback;
	};

	const loadStaff = useCallback(async () => {
		if (!canManageStaff) {
			setStaffMembers([]);
			setStaffError('');
			setStaffLoaded(true);
			return;
		}

		setStaffLoading(true);
		setStaffError('');

		try {
			const response = await getTenantStaff(tenantSlug);
			setStaffMembers(response.staff);
		} catch (error) {
			const message = normalizeErrorMessage(error, 'Gagal memuat data staff.');
			setStaffError(message);
		} finally {
			setStaffLoading(false);
			setStaffLoaded(true);
		}
	}, [canManageStaff, tenantSlug]);

	const handleSaveProfile = async (): Promise<boolean> => {
		const name = profileFormDisplayName.trim();
		if (name.length < 2) {
			markError('Nama profil minimal 2 karakter.');
			return false;
		}

		setIsSavingProfile(true);
		try {
			const response = await updateMyProfile({
				displayName: name,
				phone: profileFormPhone.trim() === '' ? null : profileFormPhone.trim(),
			});
			setProfileDisplayName(response.profile.displayName?.trim() || name);
			setProfilePhone(response.profile.phone ?? '');
			markSuccess('Profil berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal memperbarui profil.'));
			return false;
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleChangePassword = async (): Promise<boolean> => {
		if (newPassword.length < 8) {
			markError('Password baru minimal 8 karakter.');
			return false;
		}

		if (newPassword !== newPasswordConfirmation) {
			markError('Konfirmasi password tidak sama.');
			return false;
		}

		setIsChangingPassword(true);
		try {
			await changeMyPassword({
				newPassword,
				newPasswordConfirmation,
			});
			setNewPassword('');
			setNewPasswordConfirmation('');
			markSuccess('Password berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal mengubah password.'));
			return false;
		} finally {
			setIsChangingPassword(false);
		}
	};

	const handleCreateStaff = async ({
		email,
		displayName,
		temporaryPassword,
		branchIds,
	}: {
		email: string;
		displayName: string;
		temporaryPassword: string;
		branchIds: string[];
	}): Promise<boolean> => {
		try {
			await createTenantStaff({
				tenantSlug,
				email,
				displayName,
				temporaryPassword,
				branchIds,
			});
			await loadStaff();
			markSuccess('Staff berhasil ditambahkan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menambah staff.'));
			return false;
		}
	};

	const handleUpdateStaff = async ({
		membershipId,
		displayName,
		branchIds,
	}: {
		membershipId: string;
		displayName: string;
		branchIds: string[];
	}): Promise<boolean> => {
		try {
			await updateTenantStaff(membershipId, {
				tenantSlug,
				displayName,
				branchIds,
			});
			await loadStaff();
			markSuccess('Staff berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal memperbarui staff.'));
			return false;
		}
	};

	const handleResetStaffPassword = async ({
		membershipId,
		temporaryPassword,
	}: {
		membershipId: string;
		temporaryPassword: string;
	}): Promise<boolean> => {
		try {
			await resetTenantStaffPassword(membershipId, {
				tenantSlug,
				temporaryPassword,
			});
			markSuccess('Password sementara staff berhasil direset.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal mereset password staff.'));
			return false;
		}
	};

	const handleDeactivateStaff = async (membershipId: string): Promise<boolean> => {
		try {
			await deactivateTenantStaff(membershipId, { tenantSlug });
			await loadStaff();
			markSuccess('Staff berhasil dinonaktifkan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menonaktifkan staff.'));
			return false;
		}
	};

	const loadSnapshot = useCallback(async () => {
		const snapshot = await getInventorySnapshot(tenantSlug);
		setCategories(snapshot.categories);
		setUnits(snapshot.units);
		setProducts(snapshot.products);
		setOutlets(snapshot.outlets);
		setOutletStocks(snapshot.outletStocks);
		setMovements(snapshot.movements);
		setTransfers(snapshot.transfers);

		const productIdSet = new Set(snapshot.products.map((item) => item.id));
		const outletKeySet = new Set(snapshot.outlets.map((item) => `outlet:${item.id}`));

		setFavoritesByLocation((current) => {
			const next: FavoriteState = {
				central: [],
			};
			for (const [key, value] of Object.entries(current) as Array<[LocationKey, string[]]>) {
				if (key !== 'central' && !outletKeySet.has(key)) {
					continue;
				}
				next[key] = value.filter((productId) => productIdSet.has(productId));
			}
			return next;
		});

		setUsageByLocation((current) => {
			const next: UsageState = {
				central: {},
			};
			for (const [key, value] of Object.entries(current) as Array<[LocationKey, Record<string, number>]>) {
				if (key !== 'central' && !outletKeySet.has(key)) {
					continue;
				}
				next[key] = Object.fromEntries(
					Object.entries(value).filter(([productId]) => productIdSet.has(productId)),
				);
			}
			return next;
		});
	}, [tenantSlug]);

	useEffect(() => {
		void loadSnapshot().catch((error: unknown) => {
			const message = normalizeErrorMessage(error, 'Gagal memuat data inventory.');
			setError(message);
			pushToast(message, 'error');
			setEventPulse(true);
		});
	}, [loadSnapshot]);

	useEffect(() => {
		if (!canManageStaff) {
			return;
		}

		const isStaffTabOpen =
			activeTab === 'more' && activeMoreTab === 'master' && activeMasterTab === 'staff';

		if (!isStaffTabOpen || staffLoaded || staffLoading) {
			return;
		}

		void loadStaff();
	}, [
		activeMasterTab,
		activeMoreTab,
		activeTab,
		canManageStaff,
		loadStaff,
		staffLoaded,
		staffLoading,
	]);

	const handleStockMovement = async ({
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
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await submitMovement(tenantSlug, {
				productId,
				qty,
				type,
				note,
				location,
			});
			await loadSnapshot();
			bumpUsage(location, productId);
			markSuccess(
				type === 'in'
					? 'Transaksi stok masuk berhasil disimpan.'
					: 'Transaksi stok keluar berhasil disimpan.',
			);
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menyimpan transaksi stok.'));
			return false;
		}
	};

	const handleOpname = async ({
		productId,
		actualStock,
		note,
		location,
	}: {
		productId: string;
		actualStock: number;
		note: string;
		location: StockLocation;
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await submitOpname(tenantSlug, {
				productId,
				actualStock,
				note,
				location,
			});
			await loadSnapshot();
			bumpUsage(location, productId);
			markSuccess('Opname tersimpan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menyimpan opname.'));
			return false;
		}
	};

	const handleCreateCategory = async ({ name }: { name: string }): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await createCategory(tenantSlug, { name });
			await loadSnapshot();
			markSuccess('Kategori berhasil ditambahkan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menambah kategori.'));
			return false;
		}
	};

	const handleUpdateCategory = async ({
		categoryId,
		name,
	}: {
		categoryId: string;
		name: string;
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await updateCategory(tenantSlug, categoryId, { name });
			await loadSnapshot();
			markSuccess('Kategori berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal memperbarui kategori.'));
			return false;
		}
	};

	const handleDeleteCategory = async (categoryId: string): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await deleteCategory(tenantSlug, categoryId);
			await loadSnapshot();
			markSuccess('Kategori berhasil dihapus.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menghapus kategori.'));
			return false;
		}
	};

	const handleCreateUnit = async ({ name }: { name: string }): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await createUnit(tenantSlug, { name });
			await loadSnapshot();
			markSuccess('Satuan berhasil ditambahkan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menambah satuan.'));
			return false;
		}
	};

	const handleUpdateUnit = async ({
		unitId,
		name,
	}: {
		unitId: string;
		name: string;
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await updateUnit(tenantSlug, unitId, { name });
			await loadSnapshot();
			markSuccess('Satuan berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal memperbarui satuan.'));
			return false;
		}
	};

	const handleDeleteUnit = async (unitId: string): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await deleteUnit(tenantSlug, unitId);
			await loadSnapshot();
			markSuccess('Satuan berhasil dihapus.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menghapus satuan.'));
			return false;
		}
	};

	const handleCreateProduct = async ({
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
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await createProduct(tenantSlug, {
				name,
				sku,
				initialStock,
				minimumLowStock,
				categoryId,
				unitId,
			});
			await loadSnapshot();
			markSuccess('Produk berhasil ditambahkan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menambah produk.'));
			return false;
		}
	};

	const handleUpdateProduct = async ({
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
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await updateProduct(tenantSlug, productId, {
				name,
				sku,
				minimumLowStock,
				categoryId,
				unitId,
			});
			await loadSnapshot();
			markSuccess('Produk berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal memperbarui produk.'));
			return false;
		}
	};

	const handleDeleteProduct = async (productId: string): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await deleteProduct(tenantSlug, productId);
			await loadSnapshot();
			markSuccess('Produk berhasil dihapus.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menghapus produk.'));
			return false;
		}
	};

	const handleCreateOutlet = async ({
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
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await createOutlet(tenantSlug, {
				name,
				code,
				address,
				latitude,
				longitude,
			});
			await loadSnapshot();
			markSuccess('Outlet berhasil ditambahkan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menambah outlet.'));
			return false;
		}
	};

	const handleUpdateOutlet = async ({
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
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await updateOutlet(tenantSlug, outletId, {
				name,
				code,
				address,
				latitude,
				longitude,
			});
			await loadSnapshot();
			markSuccess('Outlet berhasil diperbarui.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal memperbarui outlet.'));
			return false;
		}
	};

	const handleDeleteOutlet = async (outletId: string): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await deleteOutlet(tenantSlug, outletId);
			await loadSnapshot();
			markSuccess('Outlet berhasil dihapus.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menghapus outlet.'));
			return false;
		}
	};

	const handleTransferProduct = async ({
		productId,
		source,
		destinations,
		note,
	}: {
		productId: string;
		source: StockLocation;
		destinations: Array<{ outletId: string; qty: number }>;
		note: string;
	}): Promise<boolean> => {
		if (!ensureWritable()) {
			return false;
		}

		try {
			await submitTransfer(tenantSlug, {
				productId,
				source,
				destinations,
				note,
			});
			await loadSnapshot();
			openMore('transfer');
			markSuccess('Transfer produk berhasil disimpan.');
			return true;
		} catch (error) {
			markError(normalizeErrorMessage(error, 'Gagal menyimpan transfer.'));
			return false;
		}
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
					contextLabel={headerLabel}
					contextTitle={headerTitle}
					userDisplayName={profileDisplayName}
					userRoleLabel={getMembershipRoleLabel(membershipRole)}
					subscriptionStatus={subscriptionStatus}
					trialEndAt={trialEndAt}
					eventPulse={eventPulse}
					isOpen={isProfileMenuOpen}
					menuRef={profileMenuRef}
					onToggle={() => setIsProfileMenuOpen((current) => !current)}
					onProfileClick={handleProfileClick}
					onLogoutClick={handleLogoutClick}
					onOpenBilling={() => setIsBillingDialogOpen(true)}
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

				{isReadOnly ? (
					<p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
						Mode read-only aktif karena trial/langganan belum aktif. Anda masih bisa melihat data.
						{membershipRole === 'tenant_owner' && (
							<button 
								onClick={() => setIsBillingDialogOpen(true)}
								className="ml-1 font-bold underline hover:text-amber-900"
							>
								Perpanjang sekarang.
							</button>
						)}
					</p>
				) : null}

				<div>
						{activeTab === 'dashboard' ? (
							<Dashboard
								tenantSlug={tenantSlug}
								products={products}
								movements={accessibleMovements}
								transfers={accessibleTransfers}
								outlets={outlets}
								outletStocks={accessibleOutletStocks}
								categoryNameById={categoryNameById}
								unitNameById={unitNameById}
								membershipRole={membershipRole}
								accessibleBranchIds={accessibleBranchIds}
								onOpenTransfer={() => selectMoreDialogItem('transfer')}
								onOpenHistory={() => selectMoreDialogItem('history')}
								onOpenReport={openReportFromDashboard}
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
							membershipRole={membershipRole}
							accessibleBranchIds={accessibleBranchIds}
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
							membershipRole={membershipRole}
							accessibleBranchIds={accessibleBranchIds}
						/>
					) : null}

					{activeTab === 'more' ? (
						<MoreContent
							activeTab={activeMoreTab}
							tone={activeTone}
							onChangeTab={handleMoreTabChange}
							onOpenMenu={() => setIsMoreMenuOpen(true)}
							movements={pagedMovements}
							allMovements={accessibleMovements}
							movementTotal={filteredMovements.length}
							movementPage={Math.min(historyPage, historyTotalPages)}
								movementPageSize={historyPageSize}
								movementTotalPages={historyTotalPages}
								historyFilter={historyFilter}
								historyPeriod={historyPeriod}
								historyCustomStartDate={historyCustomStartDate}
								historyCustomEndDate={historyCustomEndDate}
								historySearchQuery={historySearchQuery}
								activeMasterTab={activeMasterTab}
								onChangeHistoryFilter={setHistoryFilter}
								onChangeHistoryPeriod={setHistoryPeriod}
								onChangeHistoryCustomStartDate={setHistoryCustomStartDate}
								onChangeHistoryCustomEndDate={setHistoryCustomEndDate}
								onChangeHistorySearchQuery={setHistorySearchQuery}
								onChangeMasterTab={handleMasterTabChange}
								membershipRole={membershipRole}
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
							outletStocks={accessibleOutletStocks}
							allOutletStocks={accessibleOutletStocks}
							transfers={pagedTransfers}
							allTransfers={accessibleTransfers}
							transferTotal={accessibleTransfers.length}
							transferPage={Math.min(transferPage, transferTotalPages)}
							transferPageSize={transferPageSize}
							transferTotalPages={transferTotalPages}
							onChangeTransferPage={setTransferPage}
								onChangeTransferPageSize={setTransferPageSize}
								analyticsLocationPreset={analyticsLocationPreset}
								onConsumeAnalyticsLocationPreset={() =>
									setAnalyticsLocationPreset(null)
								}
								onCreateOutlet={handleCreateOutlet}
								onUpdateOutlet={handleUpdateOutlet}
								onDeleteOutlet={handleDeleteOutlet}
								staffMembers={staffMembers}
								staffLoading={staffLoading}
								staffError={staffError}
								onRefreshStaff={loadStaff}
								onCreateStaff={handleCreateStaff}
								onUpdateStaff={handleUpdateStaff}
								onResetStaffPassword={handleResetStaffPassword}
								onDeactivateStaff={handleDeactivateStaff}
							onSubmitTransfer={handleTransferProduct}
							onSubmitOpname={handleOpname}
							onNotifySuccess={markSuccess}
							onNotifyError={markError}
							favoritesByLocation={favoritesByLocation}
							usageByLocation={usageByLocation}
							getStockByLocation={getStockByLocation}
							onToggleFavorite={toggleFavoriteProduct}
							accessibleBranchIds={accessibleBranchIds}
						/>
					) : null}
				</div>
			</section>

			<ProfileDialog
				isOpen={isProfileDialogOpen}
				email={currentUserSession.user.email}
				displayName={profileFormDisplayName}
				phone={profileFormPhone}
				newPassword={newPassword}
				newPasswordConfirmation={newPasswordConfirmation}
				isSavingProfile={isSavingProfile}
				isChangingPassword={isChangingPassword}
				onClose={() => setIsProfileDialogOpen(false)}
				onChangeDisplayName={setProfileFormDisplayName}
				onChangePhone={setProfileFormPhone}
				onChangeNewPassword={setNewPassword}
				onChangeNewPasswordConfirmation={setNewPasswordConfirmation}
				onSaveProfile={handleSaveProfile}
				onChangePassword={handleChangePassword}
			/>

			<BillingDialog
				isOpen={isBillingDialogOpen}
				onClose={() => setIsBillingDialogOpen(false)}
				tenantSlug={tenantSlug}
				subscriptionStatus={subscriptionStatus}
			/>

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
