'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
	PAGE_SIZE_OPTIONS,
	PAGE_TONE_STYLES,
	DEFAULT_COORDINATES,
} from '@/components/inventory/constants';
import {
	AnalyticsPeriod,
	DashboardPeriod,
	GeocodeResult,
	HistoryFilter,
	HistoryPeriod,
	LocationFilter,
	MasterTab,
	MoreTab,
	PageSize,
	PageTone,
	ReportTab,
	TabKey,
	ToastTone,
} from '@/components/inventory/types';
import {
	formatDateKey,
	formatMonthKey,
	padDatePart,
	parseIntegerInput,
} from '@/components/inventory/utils/date';
import {
	getLocationFilterLabel,
	getLocationLabel,
	isMovementInLocation,
	toLocationFilterOptions,
	toLocationKey,
} from '@/components/inventory/utils/location';
import {
	buildOutletCodeFromName,
	buildSkuFromName,
	getProductUnitLabel,
	prioritizeProducts,
} from '@/components/inventory/utils/product';
import {
	buildDashboardKpis,
	buildInactiveProducts,
	buildLowStockPriorities,
	buildOutletActivitySummaries,
	buildRecentActivityFeed,
	buildTopActiveProducts,
} from '@/components/inventory/dashboard/selectors';
import { getOutletStock } from '@/components/inventory/utils/stock';
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
import {
	getDashboardAlerts,
	type DashboardAlertsResponse,
} from '@/lib/inventory/client';
import type { MembershipRole } from '@/lib/tenant/context';
import type { TenantStaffItem } from '@/lib/tenant/client';

const OutletMapPicker = dynamic(() => import('@/components/OutletMapPicker'), {
	ssr: false,
	loading: () => (
		<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
			Memuat peta...
		</div>
	),
});

const StockTrendChart = dynamic(
	() => import('@/components/inventory/charts/StockTrendChart'),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-56 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-500 sm:h-64 sm:p-3">
				Memuat grafik...
			</div>
		),
	},
);
export function TopBarProfile({
	tone,
	headerClass,
	contextLabel,
	contextTitle,
	userDisplayName,
	userRoleLabel,
	subscriptionStatus,
	trialEndAt,
	eventPulse,
	isOpen,
	menuRef,
	onToggle,
	onProfileClick,
	onLogoutClick,
	onOpenBilling,
}: {
	tone: PageTone;
	headerClass: string;
	contextLabel: string;
	contextTitle: string;
	userDisplayName: string;
	userRoleLabel: string;
	subscriptionStatus?: string | null;
	trialEndAt?: string | null;
	eventPulse: boolean;
	isOpen: boolean;
	menuRef: { current: HTMLDivElement | null };
	onToggle: () => void;
	onProfileClick: () => void;
	onLogoutClick: () => void;
	onOpenBilling?: () => void;
}) {
	const normalizedName = userDisplayName.trim() || 'Pengguna';
	const initials = normalizedName
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('') || 'PG';
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
						{contextLabel}
					</p>
					<h1 className="mt-0.5 text-lg font-semibold sm:text-xl">
						{contextTitle}
					</h1>
					{userRoleLabel === 'Owner' && (
						<div className="mt-1 flex flex-wrap gap-2">
							{subscriptionStatus === 'trialing' && (
								<div className="flex items-center gap-2">
									<span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-500/40">
										TRIAL {trialEndAt ? `s/d ${new Date(trialEndAt).toLocaleDateString('id-ID')}` : ''}
									</span>
									<button
										type="button"
										onClick={onOpenBilling}
										className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white transition hover:bg-white/25"
									>
										Perpanjang
									</button>
								</div>
							)}
							{subscriptionStatus === 'expired' && (
								<div className="flex items-center gap-2">
									<span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200 ring-1 ring-rose-500/40">
										EXPIRED
									</span>
									<button
										type="button"
										onClick={onOpenBilling}
										className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-rose-900/20 transition hover:bg-rose-600"
									>
										Perpanjang Sekarang
									</button>
								</div>
							)}
							{subscriptionStatus === 'active' && (
								<span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-500/40">
									ACTIVE
								</span>
							)}
						</div>
					)}
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
							{initials}
						</span>
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold leading-tight">
								{normalizedName}
							</span>
							<span className={`block text-[11px] leading-tight ${labelTone}`}>
								{userRoleLabel}
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

export function ProfileDialog({
	isOpen,
	email,
	displayName,
	phone,
	newPassword,
	newPasswordConfirmation,
	isSavingProfile,
	isChangingPassword,
	onClose,
	onChangeDisplayName,
	onChangePhone,
	onChangeNewPassword,
	onChangeNewPasswordConfirmation,
	onSaveProfile,
	onChangePassword,
}: {
	isOpen: boolean;
	email: string;
	displayName: string;
	phone: string;
	newPassword: string;
	newPasswordConfirmation: string;
	isSavingProfile: boolean;
	isChangingPassword: boolean;
	onClose: () => void;
	onChangeDisplayName: (value: string) => void;
	onChangePhone: (value: string) => void;
	onChangeNewPassword: (value: string) => void;
	onChangeNewPasswordConfirmation: (value: string) => void;
	onSaveProfile: () => Promise<boolean>;
	onChangePassword: () => Promise<boolean>;
}) {
	const isProfileValid = displayName.trim().length >= 2;
	const isPasswordValid =
		newPassword.length >= 8 &&
		newPasswordConfirmation.length >= 8 &&
		newPassword === newPasswordConfirmation;

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
			<div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-lg font-semibold text-slate-900">Profil Pengguna</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
					>
						Tutup
					</button>
				</div>

				<form
					className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!isProfileValid || isSavingProfile) {
							return;
						}
						await onSaveProfile();
					}}
				>
					<h4 className="text-sm font-semibold text-slate-800">Data Profil</h4>

					<label className="block">
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Email (Read-only)
						</span>
						<input
							type="email"
							value={email}
							disabled
							className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
						/>
					</label>

					<label className="block">
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Nama Tampilan
						</span>
						<input
							type="text"
							value={displayName}
							onChange={(event) => onChangeDisplayName(event.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							placeholder="Nama pengguna"
						/>
					</label>

					<label className="block">
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							No. Telepon
						</span>
						<input
							type="text"
							value={phone}
							onChange={(event) => onChangePhone(event.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							placeholder="08xxxxxxxxxx"
						/>
					</label>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={!isProfileValid || isSavingProfile}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}
						</button>
					</div>
				</form>

				<form
					className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!isPasswordValid || isChangingPassword) {
							return;
						}
						await onChangePassword();
					}}
				>
					<h4 className="text-sm font-semibold text-slate-800">Ganti Password</h4>
					<p className="text-xs text-slate-600">
						Perubahan password tidak membutuhkan password lama.
					</p>

					<label className="block">
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Password Baru
						</span>
						<input
							type="password"
							value={newPassword}
							onChange={(event) => onChangeNewPassword(event.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							placeholder="Minimal 8 karakter"
						/>
					</label>

					<label className="block">
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Konfirmasi Password Baru
						</span>
						<input
							type="password"
							value={newPasswordConfirmation}
							onChange={(event) => onChangeNewPasswordConfirmation(event.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							placeholder="Ulangi password baru"
						/>
					</label>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={!isPasswordValid || isChangingPassword}
							className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isChangingPassword ? 'Memproses...' : 'Ubah Password'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export function DesktopTabs({
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

export function Dashboard({
	tenantSlug,
	products,
	movements,
	transfers,
	outlets,
	outletStocks,
	categoryNameById,
	unitNameById,
	membershipRole,
	accessibleBranchIds,
	onOpenTransfer,
	onOpenHistory,
	onOpenReport,
}: {
	tenantSlug: string;
	products: Product[];
	movements: Movement[];
	transfers: TransferRecord[];
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	categoryNameById: Record<string, string>;
	unitNameById: Record<string, string>;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
	onOpenTransfer: () => void;
	onOpenHistory: () => void;
	onOpenReport: (
		reportTab?: ReportTab,
		locationFilter?: LocationFilter,
	) => void;
}) {
	const [dashboardLocationFilter, setDashboardLocationFilter] =
		useState<LocationFilter>('all');
	const [dashboardPeriod, setDashboardPeriod] =
		useState<DashboardPeriod>('last7days');
	const [alertsData, setAlertsData] = useState<DashboardAlertsResponse | null>(
		null,
	);
	const [alertsLoading, setAlertsLoading] = useState(false);
	const [alertsError, setAlertsError] = useState<string | null>(null);
	const locationOptions = useMemo(
		() => toLocationFilterOptions(outlets, membershipRole, accessibleBranchIds),
		[outlets, membershipRole, accessibleBranchIds],
	);
	useEffect(() => {
		const isCurrentValid = locationOptions.some(
			(option) => option.value === dashboardLocationFilter,
		);
		if (!isCurrentValid && locationOptions.length > 0) {
			setDashboardLocationFilter(locationOptions[0].value);
		}
	}, [dashboardLocationFilter, locationOptions]);
	const periodOptions = useMemo(
		() => [
			{
				value: 'today',
				label: 'Hari Ini',
				description: 'Aktivitas di hari berjalan',
			},
			{
				value: 'last7days',
				label: '7 Hari Terakhir',
				description: 'Default operasional harian',
			},
			{
				value: 'last30days',
				label: '30 Hari Terakhir',
				description: 'Ringkasan aktivitas bulanan',
			},
		],
		[],
	);
	const periodLabelByValue: Record<DashboardPeriod, string> = useMemo(
		() => ({
			today: 'Hari Ini',
			last7days: '7 Hari Terakhir',
			last30days: '30 Hari Terakhir',
		}),
		[],
	);
	const kpis = useMemo(
		() =>
			buildDashboardKpis({
				products,
				outlets,
				outletStocks,
				movements,
				transfers,
				period: dashboardPeriod,
				locationFilter: dashboardLocationFilter,
			}),
		[
			outlets,
			dashboardLocationFilter,
			dashboardPeriod,
			movements,
			outletStocks,
			products,
			transfers,
		],
	);
	const localLowStockPriorities = useMemo(
		() =>
			buildLowStockPriorities({
				products,
				outlets,
				outletStocks,
				movements,
				transfers,
				locationFilter: dashboardLocationFilter,
				limit: 5,
			}),
		[
			dashboardLocationFilter,
			movements,
			outletStocks,
			outlets,
			products,
			transfers,
		],
	);
	const inactiveProducts = useMemo(
		() =>
			buildInactiveProducts({
				products,
				movements,
				locationFilter: dashboardLocationFilter,
				limit: 5,
			}),
		[dashboardLocationFilter, movements, products],
	);
	const recentActivity = useMemo(
		() =>
			buildRecentActivityFeed({
				movements,
				transfers,
				period: dashboardPeriod,
				locationFilter: dashboardLocationFilter,
				limit: 10,
			}),
		[dashboardLocationFilter, dashboardPeriod, movements, transfers],
	);
	const topActiveProducts = useMemo(
		() =>
			buildTopActiveProducts({
				products,
				movements,
				period: dashboardPeriod,
				locationFilter: dashboardLocationFilter,
				limit: 5,
			}),
		[dashboardLocationFilter, dashboardPeriod, movements, products],
	);
	const outletSummaries = useMemo(
		() =>
			buildOutletActivitySummaries({
				outlets,
				outletStocks,
				movements,
				transfers,
				period: dashboardPeriod,
				locationFilter: dashboardLocationFilter,
			}),
		[
			dashboardLocationFilter,
			dashboardPeriod,
			movements,
			outletStocks,
			outlets,
			transfers,
		],
	);
	const locationLabel = getLocationFilterLabel(
		dashboardLocationFilter,
		outlets,
	);
	const periodLabel = periodLabelByValue[dashboardPeriod];
	const lowStockSubtitle =
		dashboardLocationFilter === 'central'
			? 'Produk pusat yang menyentuh batas minimum stok.'
			: dashboardLocationFilter.startsWith('outlet:')
				? 'Produk aktif outlet yang menyentuh batas minimum stok.'
				: 'Produk pusat dan outlet aktif yang menyentuh batas minimum stok.';
	const effectiveLowStockCount = alertsData?.lowStockCount ?? kpis.lowStockCount;
	const effectiveLowStockPriorities =
		alertsData?.lowStockPriorities ?? localLowStockPriorities;

	useEffect(() => {
		let isActive = true;
		setAlertsLoading(true);
		setAlertsError(null);
		setAlertsData(null);

		void getDashboardAlerts(tenantSlug, {
			locationFilter: dashboardLocationFilter,
			limit: 5,
		})
			.then((payload) => {
				if (!isActive) {
					return;
				}
				setAlertsData(payload);
			})
			.catch((error: unknown) => {
				if (!isActive) {
					return;
				}
				const message =
					error instanceof Error && error.message.trim() !== ''
						? error.message
						: 'Gagal memuat alert dashboard.';
				setAlertsError(message);
				setAlertsData(null);
			})
			.finally(() => {
				if (isActive) {
					setAlertsLoading(false);
				}
			});

		return () => {
			isActive = false;
		};
	}, [dashboardLocationFilter, tenantSlug]);

	const getActivityBadgeClass = (
		typeLabel: 'IN' | 'OUT' | 'OPNAME' | 'TRANSFER',
	) => {
		if (typeLabel === 'IN') {
			return 'bg-teal-100 text-teal-700';
		}
		if (typeLabel === 'OUT') {
			return 'bg-rose-100 text-rose-700';
		}
		if (typeLabel === 'OPNAME') {
			return 'bg-orange-100 text-orange-700';
		}
		return 'bg-violet-100 text-violet-700';
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">
							Dashboard Operasional
						</h2>
						<p className="mt-1 text-sm text-slate-500">
							Pantau kondisi stok dan jalankan aksi operasional dari satu layar.
						</p>
					</div>
					<button
						type="button"
						onClick={onOpenHistory}
						className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
					>
						Buka Riwayat
					</button>
				</div>

				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<SearchableOptionDropdown
						label="Lokasi"
						options={locationOptions}
						value={dashboardLocationFilter}
						onChange={(next) =>
							setDashboardLocationFilter(next as LocationFilter)
						}
						buttonPlaceholder="Pilih lokasi"
						searchPlaceholder="Cari lokasi..."
						emptyText="Lokasi tidak ditemukan."
					/>
					<SearchableOptionDropdown
						label="Periode KPI"
						options={periodOptions}
						value={dashboardPeriod}
						onChange={(next) => setDashboardPeriod(next as DashboardPeriod)}
						buttonPlaceholder="Pilih periode"
						searchPlaceholder="Cari periode..."
						emptyText="Periode tidak ditemukan."
					/>
				</div>

				<div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
					Lokasi: {locationLabel} | Periode: {periodLabel}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
				<StatCard
					label="Stok Scope"
					value={kpis.scopeStock}
					subtitle="Total stok sesuai lokasi yang dipilih."
				/>
				<StatCard
					label="Masuk"
					value={kpis.inQty}
					subtitle="Akumulasi stok masuk pada periode aktif."
				/>
				<StatCard
					label="Keluar"
					value={kpis.outQty}
					subtitle="Akumulasi stok keluar pada periode aktif."
				/>
				<StatCard
					label="Net"
					value={kpis.netQty}
					subtitle="Selisih stok masuk dikurangi stok keluar."
				/>
				<StatCard
					label="Event Opname"
					value={kpis.opnameEvents}
					subtitle="Jumlah kejadian opname pada periode aktif."
				/>
				<StatCard
					label="Produk dengan Stok Rendah"
					value={effectiveLowStockCount}
					subtitle={lowStockSubtitle}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
					<h3 className="text-base font-semibold text-slate-900">
						Alert & Prioritas
					</h3>

					<div className="mt-4">
						<p className="text-xs uppercase tracking-wide text-slate-500">
							Prioritas Stok Rendah
						</p>
						{effectiveLowStockPriorities.length === 0 ? (
							<p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
								Tidak ada produk dengan stok rendah.
							</p>
						) : (
							<ul className="mt-2 space-y-2">
								{effectiveLowStockPriorities.map((item) => {
									const product = products.find(
										(row) => row.id === item.productId,
									);
									const unit = product
										? getProductUnitLabel(product, unitNameById)
										: '-';
									return (
										<li key={`${item.locationKey}:${item.productId}`}>
											<button
												type="button"
												onClick={() =>
													onOpenReport(
														'item-report',
														dashboardLocationFilter,
													)
												}
												className="w-full rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left transition hover:bg-red-100"
											>
												<p className="text-sm font-semibold text-slate-900">
													{item.name}
												</p>
												<p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
													{item.locationLabel}
												</p>
												<p className="text-xs text-slate-600">
													{item.sku} |{' '}
													{categoryNameById[product?.categoryId ?? ''] ?? '-'}
												</p>
												<p className="mt-1 text-xs font-semibold text-red-700">
													Stok {item.currentStock} {unit} | Minimum{' '}
													{item.minimumLowStock} {unit} | Gap {item.gap}
												</p>
											</button>
										</li>
									);
								})}
							</ul>
						)}
						{alertsError ? (
							<p className="mt-2 text-xs text-amber-700">
								Menggunakan perhitungan lokal karena endpoint alert belum
								tersedia.
							</p>
						) : null}
						{alertsLoading ? (
							<p className="mt-2 text-xs text-slate-500">
								Sinkronisasi alert dashboard...
							</p>
						) : null}
					</div>

					<div className="mt-4">
						<p className="text-xs uppercase tracking-wide text-slate-500">
							Produk Tanpa Aktivitas 30 Hari
						</p>
						{inactiveProducts.length === 0 ? (
							<p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
								Semua produk memiliki aktivitas dalam 30 hari terakhir.
							</p>
						) : (
							<ul className="mt-2 space-y-2">
								{inactiveProducts.map((item) => (
									<li
										key={item.productId}
										className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
									>
										<p className="text-sm font-medium text-slate-900">
											{item.name}
										</p>
										<p className="text-xs text-slate-500">
											{item.sku} |{' '}
											{item.daysInactive >= 999
												? 'Belum pernah ada aktivitas'
												: `${item.daysInactive} hari tidak aktif`}
										</p>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
					<div className="flex items-center justify-between gap-2">
						<h3 className="text-base font-semibold text-slate-900">
							Aktivitas Terkini
						</h3>
						<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
							{recentActivity.length} item
						</span>
					</div>

					{recentActivity.length === 0 ? (
						<p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-500">
							Belum ada aktivitas pada filter saat ini.
						</p>
					) : (
						<ul className="mt-4 space-y-2">
							{recentActivity.map((item) => (
								<li
									key={item.id}
									className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
								>
									<button
										type="button"
										onClick={() =>
											item.kind === 'movement'
												? onOpenHistory()
												: onOpenTransfer()
										}
										className="w-full text-left"
									>
										<div className="flex items-center justify-between gap-2">
											<span
												className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getActivityBadgeClass(item.typeLabel)}`}
											>
												{item.typeLabel}
											</span>
											<span className="text-xs font-semibold text-slate-700">
												Qty {item.qtyText}
											</span>
										</div>
										<p className="mt-2 text-sm font-semibold text-slate-900">
											{item.title}
										</p>
										<p className="text-xs text-slate-500">{item.subtitle}</p>
										<p className="mt-1 text-[11px] text-slate-500">
											{new Date(item.createdAt).toLocaleString('id-ID')}
										</p>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
					<h3 className="text-base font-semibold text-slate-900">
						Top Produk Aktif
					</h3>
					{topActiveProducts.length === 0 ? (
						<p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-500">
							Belum ada aktivitas produk pada periode ini.
						</p>
					) : (
						<ul className="mt-4 space-y-2">
							{topActiveProducts.map((item) => (
								<li
									key={item.productId}
									className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
								>
									<p className="text-sm font-semibold text-slate-900">
										{item.name}
									</p>
									<p className="text-xs text-slate-500">{item.sku}</p>
									<p className="mt-1 text-xs font-semibold text-violet-700">
										{item.events} event | Total qty {item.totalQty}
									</p>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
					<h3 className="text-base font-semibold text-slate-900">
						Ringkasan Outlet
					</h3>
					{outletSummaries.length === 0 ? (
						<p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-500">
							{dashboardLocationFilter === 'central'
								? 'Filter Pusat tidak menampilkan ringkasan outlet.'
								: 'Belum ada outlet untuk ditampilkan.'}
						</p>
					) : (
						<ul className="mt-4 space-y-2">
							{outletSummaries.map((item) => (
								<li key={item.outletId}>
									<button
										type="button"
										onClick={() =>
											onOpenReport('analytics', `outlet:${item.outletId}`)
										}
										className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
									>
										<p className="text-sm font-semibold text-slate-900">
											{item.outletName} ({item.outletCode})
										</p>
										<p className="mt-1 text-xs text-slate-500">
											Stok outlet: {item.totalStock} | Movement:{' '}
											{item.movementEvents} | Transfer: {item.transferEvents}
										</p>
										<p className="mt-1 text-xs font-semibold text-violet-700">
											Total event: {item.totalEvents} (klik untuk analitik
											outlet)
										</p>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}

export function StatCard({
	label,
	value,
	subtitle,
}: {
	label: string;
	value: number | string;
	subtitle?: string;
}) {
	return (
		<article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
			<p
				className={`mt-2 font-bold text-slate-900 ${typeof value === 'number' ? 'text-2xl' : 'text-sm'}`}
			>
				{value}
			</p>
			{subtitle ? (
				<p className="mt-1 text-xs text-slate-500">{subtitle}</p>
			) : null}
		</article>
	);
}

export function MovementForm({
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
	membershipRole,
	accessibleBranchIds,
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
	}) => Promise<boolean>;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
}) {
	const [locationValue, setLocationValue] = useState('central');
	const [productId, setProductId] = useState(products[0]?.id ?? '');
	const [isInputModalOpen, setIsInputModalOpen] = useState(false);
	const [eventLines, setEventLines] = useState<string[] | null>(null);
	const locationOptions = useMemo(() => {
		const options = [];

		const hasCentralAccess =
			membershipRole !== 'staff' ||
			outlets.some((o) => accessibleBranchIds.includes(o.id) && o.code === 'PST');

		if (hasCentralAccess) {
			options.push({
				value: 'central',
				label: 'Pusat',
				description: 'Gudang pusat',
			});
		}

		outlets
			.filter((o) => o.code !== 'PST')
			.filter((o) => membershipRole !== 'staff' || accessibleBranchIds.includes(o.id))
			.forEach((outlet) => {
				options.push({
					value: `outlet:${outlet.id}`,
					label: `${outlet.name} (${outlet.code})`,
					description: outlet.address,
				});
			});

		return options;
	}, [outlets, membershipRole, accessibleBranchIds]);

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
						? 'Stok masuk bisa diproses dari pusat atau cabang/outlet.'
						: 'Stok keluar bisa diproses dari pusat atau cabang/outlet.'}
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
				onSave={async ({ qty, note, projectedStock }) => {
					if (!selectedProduct) {
						return;
					}

					const success = await onSubmit({
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

export function MoreContent({
	activeTab,
	activeMasterTab,
	activeReportTab,
	tone,
	onChangeTab,
	onChangeMasterTab,
	onChangeReportTab,
	onOpenMenu,
	movements,
	movementTotal,
	movementPage,
	movementPageSize,
	movementTotalPages,
	historyFilter,
	historyPeriod,
	historyCustomStartDate,
	historyCustomEndDate,
	historySearchQuery,
	onChangeHistoryFilter,
	onChangeHistoryPeriod,
	onChangeHistoryCustomStartDate,
	onChangeHistoryCustomEndDate,
	onChangeHistorySearchQuery,
	onChangeMovementPage,
	onChangeMovementPageSize,
	membershipRole,
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
	allMovements,
	allOutletStocks,
	allTransfers,
	transfers,
	transferTotal,
	transferPage,
	transferPageSize,
	transferTotalPages,
	onChangeTransferPage,
	onChangeTransferPageSize,
	analyticsLocationPreset,
	onConsumeAnalyticsLocationPreset,
	onCreateOutlet,
	onUpdateOutlet,
	onDeleteOutlet,
	staffMembers,
	staffLoading,
	staffError,
	onRefreshStaff,
	onCreateStaff,
	onUpdateStaff,
	onResetStaffPassword,
	onDeactivateStaff,
	onSubmitTransfer,
	onSubmitOpname,
	onNotifySuccess,
	onNotifyError,
	favoritesByLocation,
	usageByLocation,
	getStockByLocation,
	onToggleFavorite,
	accessibleBranchIds,
}: {
	activeTab: MoreTab;
	activeMasterTab: MasterTab;
	activeReportTab: ReportTab;
	tone: PageTone;
	onChangeTab: (tab: MoreTab) => void;
	onChangeMasterTab: (tab: MasterTab) => void;
	onChangeReportTab: (tab: ReportTab) => void;
	onOpenMenu: () => void;
	movements: Movement[];
	movementTotal: number;
	movementPage: number;
	movementPageSize: PageSize;
	movementTotalPages: number;
	historyFilter: HistoryFilter;
	historyPeriod: HistoryPeriod;
	historyCustomStartDate: string;
	historyCustomEndDate: string;
	historySearchQuery: string;
	onChangeHistoryFilter: (filter: HistoryFilter) => void;
	onChangeHistoryPeriod: (period: HistoryPeriod) => void;
	onChangeHistoryCustomStartDate: (value: string) => void;
	onChangeHistoryCustomEndDate: (value: string) => void;
	onChangeHistorySearchQuery: (value: string) => void;
	onChangeMovementPage: (page: number) => void;
	onChangeMovementPageSize: (size: PageSize) => void;
	membershipRole: MembershipRole;
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
		minimumLowStock: number;
		categoryId: string;
		unitId: string;
	}) => Promise<boolean>;
	onUpdateProduct: (payload: {
		productId: string;
		name: string;
		sku: string;
		minimumLowStock: number;
		categoryId: string;
		unitId: string;
	}) => Promise<boolean>;
	onDeleteProduct: (productId: string) => Promise<boolean>;
	onCreateCategory: (payload: { name: string }) => Promise<boolean>;
	onUpdateCategory: (payload: { categoryId: string; name: string }) => Promise<boolean>;
	onDeleteCategory: (categoryId: string) => Promise<boolean>;
	onCreateUnit: (payload: { name: string }) => Promise<boolean>;
	onUpdateUnit: (payload: { unitId: string; name: string }) => Promise<boolean>;
	onDeleteUnit: (unitId: string) => Promise<boolean>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	allMovements: Movement[];
	allOutletStocks: OutletStockRecord[];
	allTransfers: TransferRecord[];
	transfers: TransferRecord[];
	transferTotal: number;
	transferPage: number;
	transferPageSize: PageSize;
	transferTotalPages: number;
	onChangeTransferPage: (page: number) => void;
	onChangeTransferPageSize: (size: PageSize) => void;
	analyticsLocationPreset?: LocationFilter | null;
	onConsumeAnalyticsLocationPreset?: () => void;
	onCreateOutlet: (payload: {
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => Promise<boolean>;
	onUpdateOutlet: (payload: {
		outletId: string;
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => Promise<boolean>;
	onDeleteOutlet: (outletId: string) => Promise<boolean>;
	staffMembers: TenantStaffItem[];
	staffLoading: boolean;
	staffError: string;
	onRefreshStaff: () => Promise<void>;
	onCreateStaff: (payload: {
		email: string;
		displayName: string;
		temporaryPassword: string;
		branchIds: string[];
	}) => Promise<boolean>;
	onUpdateStaff: (payload: {
		membershipId: string;
		displayName: string;
		branchIds: string[];
	}) => Promise<boolean>;
	onResetStaffPassword: (payload: {
		membershipId: string;
		temporaryPassword: string;
	}) => Promise<boolean>;
	onDeactivateStaff: (membershipId: string) => Promise<boolean>;
	onSubmitTransfer: (payload: {
		productId: string;
		source: StockLocation;
		destinations: Array<{ outletId: string; qty: number }>;
		note: string;
	}) => Promise<boolean>;
	onSubmitOpname: (payload: {
		productId: string;
		actualStock: number;
		note: string;
		location: StockLocation;
	}) => Promise<boolean>;
	onNotifySuccess: (message: string) => void;
	onNotifyError: (message: string) => void;
	favoritesByLocation: FavoriteState;
	usageByLocation: UsageState;
	getStockByLocation: (productId: string, location: StockLocation) => number;
	onToggleFavorite: (location: StockLocation, productId: string) => void;
	accessibleBranchIds: string[];
}) {
	const tabs: { key: MoreTab; label: string }[] = [
		{ key: 'history', label: 'Riwayat' },
		{ key: 'master', label: 'Master' },
		{ key: 'transfer', label: 'Transfer' },
		{ key: 'opname', label: 'Opname' },
		{ key: 'report', label: 'Laporan' },
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
					period={historyPeriod}
					customStartDate={historyCustomStartDate}
					customEndDate={historyCustomEndDate}
					searchQuery={historySearchQuery}
					onChangeFilter={onChangeHistoryFilter}
					onChangePeriod={onChangeHistoryPeriod}
					onChangeCustomStartDate={onChangeHistoryCustomStartDate}
					onChangeCustomEndDate={onChangeHistoryCustomEndDate}
					onChangeSearchQuery={onChangeHistorySearchQuery}
					onChangePage={onChangeMovementPage}
					onChangePageSize={onChangeMovementPageSize}
				/>
			) : null}

			{activeTab === 'master' ? (
				<MasterModule
					activeTab={activeMasterTab}
					onChangeTab={onChangeMasterTab}
					membershipRole={membershipRole}
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
					outlets={outlets}
					outletStocks={outletStocks}
					onCreateOutlet={onCreateOutlet}
					onUpdateOutlet={onUpdateOutlet}
					onDeleteOutlet={onDeleteOutlet}
					staffMembers={staffMembers}
					staffLoading={staffLoading}
					staffError={staffError}
					onRefreshStaff={onRefreshStaff}
					onCreateStaff={onCreateStaff}
					onUpdateStaff={onUpdateStaff}
					onResetStaffPassword={onResetStaffPassword}
					onDeactivateStaff={onDeactivateStaff}
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
					membershipRole={membershipRole}
					accessibleBranchIds={accessibleBranchIds}
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
					membershipRole={membershipRole}
					accessibleBranchIds={accessibleBranchIds}
				/>
			) : null}

			{activeTab === 'report' ? (
				<ReportModule
					activeTab={activeReportTab}
					onChangeTab={onChangeReportTab}
					products={products}
					categories={categories}
					movements={allMovements}
					unitNameById={unitNameById}
					categoryNameById={categoryNameById}
					outlets={outlets}
					outletStocks={allOutletStocks}
					onSuccess={onNotifySuccess}
					onError={onNotifyError}
					analyticsLocationPreset={analyticsLocationPreset}
					onConsumeAnalyticsLocationPreset={onConsumeAnalyticsLocationPreset}
					membershipRole={membershipRole}
					accessibleBranchIds={accessibleBranchIds}
				/>
			) : null}
		</div>
	);
}

export function MasterModule({
	activeTab,
	onChangeTab,
	membershipRole,
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
	onCreateOutlet,
	onUpdateOutlet,
	onDeleteOutlet,
	staffMembers,
	staffLoading,
	staffError,
	onRefreshStaff,
	onCreateStaff,
	onUpdateStaff,
	onResetStaffPassword,
	onDeactivateStaff,
}: {
	activeTab: MasterTab;
	onChangeTab: (tab: MasterTab) => void;
	membershipRole: MembershipRole;
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
		minimumLowStock: number;
		categoryId: string;
		unitId: string;
	}) => Promise<boolean>;
	onUpdateProduct: (payload: {
		productId: string;
		name: string;
		sku: string;
		minimumLowStock: number;
		categoryId: string;
		unitId: string;
	}) => Promise<boolean>;
	onDeleteProduct: (productId: string) => Promise<boolean>;
	onCreateCategory: (payload: { name: string }) => Promise<boolean>;
	onUpdateCategory: (payload: { categoryId: string; name: string }) => Promise<boolean>;
	onDeleteCategory: (categoryId: string) => Promise<boolean>;
	onCreateUnit: (payload: { name: string }) => Promise<boolean>;
	onUpdateUnit: (payload: { unitId: string; name: string }) => Promise<boolean>;
	onDeleteUnit: (unitId: string) => Promise<boolean>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	onCreateOutlet: (payload: {
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => Promise<boolean>;
	onUpdateOutlet: (payload: {
		outletId: string;
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => Promise<boolean>;
	onDeleteOutlet: (outletId: string) => Promise<boolean>;
	staffMembers: TenantStaffItem[];
	staffLoading: boolean;
	staffError: string;
	onRefreshStaff: () => Promise<void>;
	onCreateStaff: (payload: {
		email: string;
		displayName: string;
		temporaryPassword: string;
		branchIds: string[];
	}) => Promise<boolean>;
	onUpdateStaff: (payload: {
		membershipId: string;
		displayName: string;
		branchIds: string[];
	}) => Promise<boolean>;
	onResetStaffPassword: (payload: {
		membershipId: string;
		temporaryPassword: string;
	}) => Promise<boolean>;
	onDeactivateStaff: (membershipId: string) => Promise<boolean>;
}) {
	const tabs: { key: MasterTab; label: string }[] = [
		{ key: 'products', label: 'Produk' },
		{ key: 'categories', label: 'Kategori' },
		{ key: 'units', label: 'Satuan' },
	];

	if (membershipRole !== 'staff') {
		tabs.push({ key: 'outlets', label: 'Outlet' });
	}

	const canManageStaff = membershipRole === 'tenant_owner';
	if (canManageStaff) {
		tabs.push({ key: 'staff', label: 'Staff' });
	}

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

			{activeTab === 'staff' && canManageStaff ? (
				<StaffManager
					staff={staffMembers}
					outlets={outlets}
					loading={staffLoading}
					error={staffError}
					onRefresh={onRefreshStaff}
					onCreate={onCreateStaff}
					onUpdate={onUpdateStaff}
					onResetPassword={onResetStaffPassword}
					onDeactivate={onDeactivateStaff}
				/>
			) : null}
		</div>
	);
}

export function History({
	movements,
	products,
	unitNameById,
	totalItems,
	page,
	pageSize,
	totalPages,
	filter,
	period,
	customStartDate,
	customEndDate,
	searchQuery,
	onChangeFilter,
	onChangePeriod,
	onChangeCustomStartDate,
	onChangeCustomEndDate,
	onChangeSearchQuery,
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
	period: HistoryPeriod;
	customStartDate: string;
	customEndDate: string;
	searchQuery: string;
	onChangeFilter: (filter: HistoryFilter) => void;
	onChangePeriod: (period: HistoryPeriod) => void;
	onChangeCustomStartDate: (value: string) => void;
	onChangeCustomEndDate: (value: string) => void;
	onChangeSearchQuery: (value: string) => void;
	onChangePage: (page: number) => void;
	onChangePageSize: (size: PageSize) => void;
}) {
	const filters: { key: HistoryFilter; label: string }[] = [
		{ key: 'all', label: 'Semua' },
		{ key: 'in', label: 'Masuk' },
		{ key: 'out', label: 'Keluar' },
		{ key: 'opname', label: 'Opname' },
	];
	const periodFilters: Array<{ key: HistoryPeriod; label: string }> = [
		{ key: 'today', label: 'Hari Ini' },
		{ key: 'last7days', label: '7 Hari' },
		{ key: 'last30days', label: '30 Hari' },
		{ key: 'custom', label: 'Custom' },
	];

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
			<h2 className="text-lg font-semibold text-slate-900">
				Riwayat Pergerakan Stok
			</h2>
			<p className="mt-1 text-sm text-slate-500">
				Filter berdasarkan tipe transaksi, periode, dan rentang tanggal custom.
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

			<div className="mt-4 flex flex-wrap gap-2">
				{periodFilters.map((item) => (
					<button
						key={item.key}
						type="button"
						onClick={() => onChangePeriod(item.key)}
						className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
							period === item.key
								? 'bg-violet-600 text-white'
								: 'bg-violet-50 text-violet-700'
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			{period === 'custom' ? (
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					<label>
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Tanggal Mulai
						</span>
						<input
							type="date"
							value={customStartDate}
							onChange={(event) => onChangeCustomStartDate(event.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						/>
					</label>

					<label>
						<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Tanggal Akhir
						</span>
						<input
							type="date"
							value={customEndDate}
							onChange={(event) => onChangeCustomEndDate(event.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						/>
					</label>
				</div>
			) : null}

			<label className="mt-4 block">
				<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
					Cari Produk
				</span>
				<input
					type="search"
					value={searchQuery}
					onChange={(event) => onChangeSearchQuery(event.target.value)}
					placeholder="Cari nama produk / SKU"
					className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
				/>
			</label>

			{movements.length === 0 ? (
				<p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-500">
					{searchQuery.trim()
						? 'Produk tidak ditemukan untuk filter yang dipilih.'
						: period === 'custom'
							? 'Tidak ada data riwayat pada rentang tanggal custom.'
							: 'Tidak ada data riwayat untuk filter ini.'}
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

export function StockAnalyticsModule({
	products,
	categories,
	unitNameById,
	categoryNameById,
	outlets,
	outletStocks,
	movements,
	locationPreset,
	onConsumeLocationPreset,
	membershipRole,
	accessibleBranchIds,
}: {
	products: Product[];
	categories: Category[];
	unitNameById: Record<string, string>;
	categoryNameById: Record<string, string>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	movements: Movement[];
	locationPreset?: LocationFilter | null;
	onConsumeLocationPreset?: () => void;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
}) {
	const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
	const [period, setPeriod] = useState<AnalyticsPeriod>('last30days');

	const locationOptions = useMemo(
		() => toLocationFilterOptions(outlets, membershipRole, accessibleBranchIds),
		[outlets, membershipRole, accessibleBranchIds],
	);
	useEffect(() => {
		const isCurrentValid = locationOptions.some(
			(option) => option.value === locationFilter,
		);
		if (!isCurrentValid && locationOptions.length > 0) {
			setLocationFilter(locationOptions[0].value);
		}
	}, [locationFilter, locationOptions]);
	const periodOptions = useMemo(
		() => [
			{
				value: 'last30days',
				label: '30 Hari',
				description: 'Tren harian 30 hari terakhir',
			},
			{
				value: 'monthly',
				label: 'Bulanan (12 bulan)',
				description: 'Ringkasan tren per bulan',
			},
			{
				value: 'yearly',
				label: 'Tahunan (5 tahun)',
				description: 'Ringkasan tren per tahun',
			},
		],
		[],
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
	const outletTotalByProductId = useMemo(() => {
		return outletStocks.reduce<Record<string, number>>(
			(accumulator, record) => {
				accumulator[record.productId] =
					(accumulator[record.productId] ?? 0) + record.qty;
				return accumulator;
			},
			{},
		);
	}, [outletStocks]);

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
		return products.reduce((sum, product) => {
			if (locationFilter === 'central') {
				return sum + product.stock;
			}
			if (locationFilter.startsWith('outlet:')) {
				const outletId = locationFilter.slice('outlet:'.length);
				return sum + (outletStockMap[`${outletId}:${product.id}`] ?? 0);
			}
			const outletTotal = outletTotalByProductId[product.id] ?? 0;
			return sum + product.stock + outletTotal;
		}, 0);
	}, [locationFilter, outletStockMap, outletTotalByProductId, products]);

	const locationLabel = getLocationFilterLabel(locationFilter, outlets);

	useEffect(() => {
		if (!locationPreset) {
			return;
		}
		setLocationFilter(locationPreset);
		onConsumeLocationPreset?.();
	}, [locationPreset, onConsumeLocationPreset]);

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">Analitik Stok</h2>
				<p className="mt-1 text-sm text-slate-500">
					Laporan data barang dan tren pergerakan stok per periode.
				</p>

				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<SearchableOptionDropdown
						label="Lokasi"
						options={locationOptions}
						value={locationFilter}
						onChange={(next) => setLocationFilter(next as LocationFilter)}
						buttonPlaceholder="Pilih lokasi"
						searchPlaceholder="Cari lokasi..."
						emptyText="Lokasi tidak ditemukan."
					/>

					<SearchableOptionDropdown
						label="Periode Tren"
						options={periodOptions}
						value={period}
						onChange={(next) => setPeriod(next as AnalyticsPeriod)}
						buttonPlaceholder="Pilih periode"
						searchPlaceholder="Cari periode..."
						emptyText="Periode tidak ditemukan."
					/>
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
						<StockTrendChart trendData={trendData} period={period} />
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
		</div>
	);
}

export function ExportStockModule({
	products,
	unitNameById,
	categoryNameById,
	outlets,
	outletStocks,
	onSuccess,
	onError,
	membershipRole,
	accessibleBranchIds,
}: {
	products: Product[];
	unitNameById: Record<string, string>;
	categoryNameById: Record<string, string>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	onSuccess: (message: string) => void;
	onError: (message: string) => void;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
}) {
	const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
	const [productQuery, setProductQuery] = useState('');
	const locationOptions = useMemo(
		() => toLocationFilterOptions(outlets, membershipRole, accessibleBranchIds),
		[outlets, membershipRole, accessibleBranchIds],
	);
	useEffect(() => {
		const isCurrentValid = locationOptions.some(
			(option) => option.value === locationFilter,
		);
		if (!isCurrentValid && locationOptions.length > 0) {
			setLocationFilter(locationOptions[0].value);
		}
	}, [locationFilter, locationOptions]);
	const outletQuantitiesByOutletId = useMemo(() => {
		const map: Record<string, Record<string, number>> = {};
		for (const record of outletStocks) {
			if (!map[record.outletId]) {
				map[record.outletId] = {};
			}
			map[record.outletId][record.productId] = record.qty;
		}
		return map;
	}, [outletStocks]);

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
				const outletQuantities = outletQuantitiesByOutletId[outlet.id] ?? {};
				pushProductRows(`${outlet.name} (${outlet.code})`, outletQuantities);
			});
		} else if (locationFilter.startsWith('outlet:')) {
			const outletId = locationFilter.slice('outlet:'.length);
			const outlet = outlets.find((item) => item.id === outletId);
			if (outlet) {
				const outletQuantities = outletQuantitiesByOutletId[outlet.id] ?? {};
				pushProductRows(`${outlet.name} (${outlet.code})`, outletQuantities);
			}
		}

		return rows;
	}, [
		categoryNameById,
		locationFilter,
		outletQuantitiesByOutletId,
		outlets,
		products,
		unitNameById,
	]);

	const handleExportExcel = async () => {
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

		try {
			const XLSX = await import('xlsx');
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
		} catch {
			onError('Ekspor gagal. Coba lagi dalam beberapa saat.');
		}
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
					<SearchableOptionDropdown
						label="Lokasi"
						options={locationOptions}
						value={locationFilter}
						onChange={(next) => setLocationFilter(next as LocationFilter)}
						buttonPlaceholder="Pilih lokasi"
						searchPlaceholder="Cari lokasi..."
						emptyText="Lokasi tidak ditemukan."
					/>

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

export function ProductDataReportModule({
	products,
	categories,
	unitNameById,
	categoryNameById,
	outlets,
	outletStocks,
	membershipRole,
	accessibleBranchIds,
}: {
	products: Product[];
	categories: Category[];
	unitNameById: Record<string, string>;
	categoryNameById: Record<string, string>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
}) {
	const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
	const [categoryFilter, setCategoryFilter] = useState('all');
	const [productQuery, setProductQuery] = useState('');
	const locationOptions = useMemo(
		() => toLocationFilterOptions(outlets, membershipRole, accessibleBranchIds),
		[outlets, membershipRole, accessibleBranchIds],
	);
	useEffect(() => {
		const isCurrentValid = locationOptions.some(
			(option) => option.value === locationFilter,
		);
		if (!isCurrentValid && locationOptions.length > 0) {
			setLocationFilter(locationOptions[0].value);
		}
	}, [locationFilter, locationOptions]);
	const categoryOptions = useMemo(() => {
		const usageByCategoryId = products.reduce<Record<string, number>>(
			(accumulator, product) => {
				accumulator[product.categoryId] =
					(accumulator[product.categoryId] ?? 0) + 1;
				return accumulator;
			},
			{},
		);

		return [
			{
				value: 'all',
				label: 'Semua kategori',
				description: `${products.length} produk`,
			},
			...categories.map((category) => ({
				value: category.id,
				label: category.name,
				description: `${usageByCategoryId[category.id] ?? 0} produk`,
			})),
		];
	}, [categories, products]);
	const outletStockMap = useMemo(() => {
		return outletStocks.reduce<Record<string, number>>(
			(accumulator, record) => {
				accumulator[`${record.outletId}:${record.productId}`] = record.qty;
				return accumulator;
			},
			{},
		);
	}, [outletStocks]);
	const outletTotalByProductId = useMemo(() => {
		return outletStocks.reduce<Record<string, number>>(
			(accumulator, record) => {
				accumulator[record.productId] =
					(accumulator[record.productId] ?? 0) + record.qty;
				return accumulator;
			},
			{},
		);
	}, [outletStocks]);

	const reportRows = useMemo(() => {
		return [...products]
			.sort((a, b) => a.name.localeCompare(b.name, 'id'))
			.map((product) => {
				const outletTotal = outletTotalByProductId[product.id] ?? 0;
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
					categoryId: product.categoryId,
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
		outletTotalByProductId,
		products,
		unitNameById,
	]);
	const normalizedProductQuery = productQuery.trim().toLocaleLowerCase('id');
	const filteredReportRows = useMemo(() => {
		return reportRows.filter((row) => {
			if (categoryFilter !== 'all' && row.categoryId !== categoryFilter) {
				return false;
			}
			if (!normalizedProductQuery) {
				return true;
			}
			return `${row.name} ${row.sku}`
				.toLocaleLowerCase('id')
				.includes(normalizedProductQuery);
		});
	}, [categoryFilter, normalizedProductQuery, reportRows]);

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h2 className="text-lg font-semibold text-slate-900">
					Laporan Data Barang
				</h2>
				<p className="mt-1 text-sm text-slate-500">
					Menampilkan stok pusat, stok outlet, dan total gabungan per produk.
				</p>

				<div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
					<SearchableOptionDropdown
						label="Lokasi"
						options={locationOptions}
						value={locationFilter}
						onChange={(next) => setLocationFilter(next as LocationFilter)}
						buttonPlaceholder="Pilih lokasi"
						searchPlaceholder="Cari lokasi..."
						emptyText="Lokasi tidak ditemukan."
					/>
					<SearchableOptionDropdown
						label="Kategori"
						options={categoryOptions}
						value={categoryFilter}
						onChange={setCategoryFilter}
						buttonPlaceholder="Semua kategori"
						searchPlaceholder="Cari kategori..."
						emptyText="Kategori tidak ditemukan."
					/>

					<div>
						<label
							htmlFor="item-report-product-search"
							className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
						>
							Cari Produk
						</label>
						<input
							id="item-report-product-search"
							type="search"
							value={productQuery}
							onChange={(event) => setProductQuery(event.target.value)}
							placeholder="Cari nama produk / SKU"
							className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
						/>
					</div>
				</div>

				<p className="mt-3 text-xs text-slate-500">
					Menampilkan {filteredReportRows.length} dari {reportRows.length}{' '}
					produk.
				</p>

				{filteredReportRows.length === 0 ? (
					<div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
						Produk tidak ditemukan.
					</div>
				) : null}

				<div
					className={`mt-4 space-y-3 md:hidden ${filteredReportRows.length === 0 ? 'hidden' : ''}`}
				>
					{filteredReportRows.map((row) => (
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

				<div
					className={`mt-4 hidden md:block ${filteredReportRows.length === 0 ? 'md:hidden' : ''}`}
				>
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
							{filteredReportRows.map((row) => (
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

export function ReportModule({
	activeTab,
	onChangeTab,
	products,
	categories,
	movements,
	unitNameById,
	categoryNameById,
	outlets,
	outletStocks,
	onSuccess,
	onError,
	analyticsLocationPreset,
	onConsumeAnalyticsLocationPreset,
	membershipRole,
	accessibleBranchIds,
}: {
	activeTab: ReportTab;
	onChangeTab: (tab: ReportTab) => void;
	products: Product[];
	categories: Category[];
	movements: Movement[];
	unitNameById: Record<string, string>;
	categoryNameById: Record<string, string>;
	outlets: Outlet[];
	outletStocks: OutletStockRecord[];
	onSuccess: (message: string) => void;
	onError: (message: string) => void;
	analyticsLocationPreset?: LocationFilter | null;
	onConsumeAnalyticsLocationPreset?: () => void;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
}) {
	const tabs: Array<{ key: ReportTab; label: string }> = [
		{ key: 'analytics', label: 'Analitik Stok' },
		{ key: 'export', label: 'Ekspor Data' },
		{ key: 'item-report', label: 'Data Barang' },
	];

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
				<p className="text-xs uppercase tracking-wide text-slate-500">
					Laporan
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

			{activeTab === 'analytics' ? (
				<StockAnalyticsModule
					products={products}
					categories={categories}
					unitNameById={unitNameById}
					categoryNameById={categoryNameById}
					outlets={outlets}
					outletStocks={outletStocks}
					movements={movements}
					locationPreset={analyticsLocationPreset}
					onConsumeLocationPreset={onConsumeAnalyticsLocationPreset}
					membershipRole={membershipRole}
					accessibleBranchIds={accessibleBranchIds}
				/>
			) : null}

			{activeTab === 'export' ? (
				<ExportStockModule
					products={products}
					unitNameById={unitNameById}
					categoryNameById={categoryNameById}
					outlets={outlets}
					outletStocks={outletStocks}
					onSuccess={onSuccess}
					onError={onError}
					membershipRole={membershipRole}
					accessibleBranchIds={accessibleBranchIds}
				/>
			) : null}

			{activeTab === 'item-report' ? (
				<ProductDataReportModule
					products={products}
					categories={categories}
					unitNameById={unitNameById}
					categoryNameById={categoryNameById}
					outlets={outlets}
					outletStocks={outletStocks}
					membershipRole={membershipRole}
					accessibleBranchIds={accessibleBranchIds}
				/>
			) : null}
		</div>
	);
}

export function ManageProducts({
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
		minimumLowStock: number;
		categoryId: string;
		unitId: string;
	}) => Promise<boolean>;
	onUpdate: (payload: {
		productId: string;
		name: string;
		sku: string;
		minimumLowStock: number;
		categoryId: string;
		unitId: string;
	}) => Promise<boolean>;
	onDelete: (productId: string) => Promise<boolean>;
}) {
	const [newName, setNewName] = useState('');
	const [newSku, setNewSku] = useState('');
	const [newStockInput, setNewStockInput] = useState('0');
	const [newMinimumLowStockInput, setNewMinimumLowStockInput] = useState('10');
	const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id ?? '');
	const [newUnitId, setNewUnitId] = useState(units[0]?.id ?? '');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState('');
	const [editingSku, setEditingSku] = useState('');
	const [editingMinimumLowStockInput, setEditingMinimumLowStockInput] =
		useState('10');
	const [editingCategoryId, setEditingCategoryId] = useState('');
	const [editingUnitId, setEditingUnitId] = useState('');
	const [newNameError, setNewNameError] = useState('');
	const [editingNameError, setEditingNameError] = useState('');
	const [isGeneratingSku, setIsGeneratingSku] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState('all');
	const [productQuery, setProductQuery] = useState('');
	const newStock = Math.max(0, parseIntegerInput(newStockInput, 0));
	const newMinimumLowStock = Math.max(
		0,
		parseIntegerInput(newMinimumLowStockInput, 10),
	);
	const editingMinimumLowStock = Math.max(
		0,
		parseIntegerInput(editingMinimumLowStockInput, 10),
	);
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
	const categorySelectOptions = useMemo(
		() =>
			categories.map((category) => ({
				value: category.id,
				label: category.name,
				description: `${categoryUsageCount[category.id] ?? 0} produk`,
			})),
		[categories, categoryUsageCount],
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
					onSubmit={async (event: FormEvent<HTMLFormElement>) => {
						event.preventDefault();

						const success = await onCreate({
							name: newName,
							sku: newSku,
							initialStock: newStock,
							minimumLowStock: newMinimumLowStock,
							categoryId: newCategoryId,
							unitId: newUnitId,
						});

						if (success) {
							setNewName('');
							setNewSku('');
							setNewStockInput('0');
							setNewMinimumLowStockInput('10');
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
						<div className="space-y-1 text-sm text-slate-700">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
								Kategori
							</span>
							<SearchableOptionDropdown
								options={categorySelectOptions}
								value={newCategoryId}
								onChange={setNewCategoryId}
								buttonPlaceholder="Pilih kategori"
								searchPlaceholder="Cari kategori..."
								emptyText="Kategori tidak ditemukan."
							/>
						</div>
					<div className="space-y-1 text-sm text-slate-700">
						<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Satuan
						</span>
						<SearchableOptionDropdown
							options={unitOptions}
							value={newUnitId}
							onChange={setNewUnitId}
							buttonPlaceholder="Pilih satuan"
							searchPlaceholder="Cari satuan..."
							emptyText="Satuan tidak ditemukan."
						/>
					</div>
					<label className="space-y-1 text-sm text-slate-700">
						<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Stok Awal
						</span>
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
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
					</label>
					<label className="space-y-1 text-sm text-slate-700">
						<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Minimum Stok
						</span>
						<input
							type="number"
							min={0}
							step={1}
							value={newMinimumLowStockInput}
							onChange={(event) => {
								const raw = event.target.value;
								setNewMinimumLowStockInput(raw);
								if (raw === '') {
									return;
								}
								setNewMinimumLowStockInput(
									`${Math.max(0, parseIntegerInput(raw, 10))}`,
								);
							}}
							placeholder="Minimum stok rendah"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
					</label>
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
							<div className="w-full sm:w-56">
								<SearchableOptionDropdown
									options={categoryFilterOptions}
									value={categoryFilter}
									onChange={(next) => {
										setCategoryFilter(next);
										onChangePage(1);
									}}
									buttonPlaceholder="Semua kategori"
									searchPlaceholder="Cari kategori..."
									emptyText="Kategori tidak ditemukan."
								/>
							</div>
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
												<div className="space-y-1 text-sm text-slate-700">
													<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
														Kategori
													</span>
													<SearchableOptionDropdown
														options={categorySelectOptions}
														value={editingCategoryId}
														onChange={setEditingCategoryId}
														buttonPlaceholder="Pilih kategori"
														searchPlaceholder="Cari kategori..."
														emptyText="Kategori tidak ditemukan."
													/>
												</div>
											<div className="space-y-1 text-sm text-slate-700">
												<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
													Satuan
												</span>
												<SearchableOptionDropdown
													options={unitOptions}
													value={editingUnitId}
													onChange={setEditingUnitId}
													buttonPlaceholder="Pilih satuan"
													searchPlaceholder="Cari satuan..."
													emptyText="Satuan tidak ditemukan."
													compact
												/>
											</div>
											<label className="space-y-1 text-sm text-slate-700">
												<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
													Minimum Stok
												</span>
												<input
													type="number"
													min={0}
													step={1}
													value={editingMinimumLowStockInput}
													onChange={(event) => {
														const raw = event.target.value;
														setEditingMinimumLowStockInput(raw);
														if (raw === '') {
															return;
														}
														setEditingMinimumLowStockInput(
															`${Math.max(0, parseIntegerInput(raw, 10))}`,
														);
													}}
													placeholder="Minimum stok rendah"
													className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
												/>
											</label>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={async () => {
														const success = await onUpdate({
															productId: product.id,
															name: editingName,
															sku: editingSku,
															minimumLowStock: editingMinimumLowStock,
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
													{categoryNameById[product.categoryId] ?? '-'} |
													Satuan: {unitNameById[product.unitId] ?? '-'} | Stok
													pusat: {product.stock} | Min stok rendah:{' '}
													{product.minimumLowStock}
												</p>
											</div>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														setEditingId(product.id);
														setEditingName(product.name);
														setEditingSku(product.sku);
														setEditingMinimumLowStockInput(
															`${product.minimumLowStock}`,
														);
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

export function CategoryManager({
	categories,
	products,
	onCreate,
	onUpdate,
	onDelete,
}: {
	categories: Category[];
	products: Product[];
	onCreate: (payload: { name: string }) => Promise<boolean>;
	onUpdate: (payload: { categoryId: string; name: string }) => Promise<boolean>;
	onDelete: (categoryId: string) => Promise<boolean>;
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
					onSubmit={async (event) => {
						event.preventDefault();
						const success = await onCreate({ name: newName });
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
												onClick={async () => {
													const success = await onUpdate({
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

export function UnitManager({
	units,
	products,
	onCreate,
	onUpdate,
	onDelete,
}: {
	units: Unit[];
	products: Product[];
	onCreate: (payload: { name: string }) => Promise<boolean>;
	onUpdate: (payload: { unitId: string; name: string }) => Promise<boolean>;
	onDelete: (unitId: string) => Promise<boolean>;
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
					onSubmit={async (event) => {
						event.preventDefault();
						const success = await onCreate({ name: newName });
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
												onClick={async () => {
													const success = await onUpdate({
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

export function OutletManager({
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
	}) => Promise<boolean>;
	onUpdate: (payload: {
		outletId: string;
		name: string;
		code: string;
		address: string;
		latitude: number;
		longitude: number;
	}) => Promise<boolean>;
	onDelete: (outletId: string) => Promise<boolean>;
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
	const [nameError, setNameError] = useState('');
	const [isGeneratingCode, setIsGeneratingCode] = useState(false);

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

	const outletStockSummary = useMemo(() => {
		const totalByOutletId: Record<string, number> = {};
		const activeProductIdsByOutletId: Record<string, Set<string>> = {};

		for (const record of outletStocks) {
			totalByOutletId[record.outletId] =
				(totalByOutletId[record.outletId] ?? 0) + record.qty;

			if (record.qty > 0) {
				if (!activeProductIdsByOutletId[record.outletId]) {
					activeProductIdsByOutletId[record.outletId] = new Set();
				}
				activeProductIdsByOutletId[record.outletId].add(record.productId);
			}
		}

		const activeCountByOutletId: Record<string, number> = {};
		for (const [outletId, productSet] of Object.entries(
			activeProductIdsByOutletId,
		)) {
			activeCountByOutletId[outletId] = productSet.size;
		}

		return {
			totalByOutletId,
			activeCountByOutletId,
			activeProductIdsByOutletId,
		};
	}, [outletStocks]);

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
		setNameError('');
		setIsGeneratingCode(false);
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
		setNameError('');
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
					onSubmit={async (event) => {
						event.preventDefault();

						const payload = {
							name,
							code,
							address,
							latitude,
							longitude,
						};

						const success = editingId
							? await onUpdate({ outletId: editingId, ...payload })
							: await onCreate(payload);

						if (success) {
							clearForm();
						}
					}}
				>
					<div className="grid gap-3 sm:grid-cols-2">
						<input
							value={name}
							onChange={(event) => {
								setName(event.target.value);
								if (nameError) {
									setNameError('');
								}
							}}
							placeholder="Nama outlet"
							className={`rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-slate-500 ${
								nameError ? 'border-red-400' : 'border-slate-300'
							}`}
							required
						/>
						<div className="flex gap-2">
							<input
								value={code}
								onChange={(event) => setCode(event.target.value)}
								placeholder="Kode outlet"
								className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none transition focus:border-slate-500"
								required
							/>
							<button
								type="button"
								onClick={async () => {
									const cleanedName = name.trim();
									if (!cleanedName) {
										setNameError(
											'Nama outlet wajib diisi sebelum generate kode outlet.',
										);
										return;
									}

									setIsGeneratingCode(true);
									await new Promise((resolve) => setTimeout(resolve, 700));
									setCode(
										buildOutletCodeFromName(
											cleanedName,
											outlets,
											editingId ?? undefined,
										),
									);
									setIsGeneratingCode(false);
								}}
								disabled={isGeneratingCode}
								className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Generate Kode
							</button>
						</div>
					</div>
					{nameError ? <p className="-mt-1 text-xs text-red-600">{nameError}</p> : null}

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
							const totalStock =
								outletStockSummary.totalByOutletId[outlet.id] ?? 0;
							const activeProductCount =
								outletStockSummary.activeCountByOutletId[outlet.id] ?? 0;
							const activeProductSet =
								outletStockSummary.activeProductIdsByOutletId[outlet.id];
							const availableProductNames =
								products
									.filter((product) => activeProductSet?.has(product.id))
									.map((product) => product.name)
									.join(', ') || 'Belum ada stok produk';

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
										Produk tersedia: {availableProductNames}
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

export function StaffManager({
	staff,
	outlets,
	loading,
	error,
	onRefresh,
	onCreate,
	onUpdate,
	onResetPassword,
	onDeactivate,
}: {
	staff: TenantStaffItem[];
	outlets: Outlet[];
	loading: boolean;
	error: string;
	onRefresh: () => Promise<void>;
	onCreate: (payload: {
		email: string;
		displayName: string;
		temporaryPassword: string;
		branchIds: string[];
	}) => Promise<boolean>;
	onUpdate: (payload: {
		membershipId: string;
		displayName: string;
		branchIds: string[];
	}) => Promise<boolean>;
	onResetPassword: (payload: {
		membershipId: string;
		temporaryPassword: string;
	}) => Promise<boolean>;
	onDeactivate: (membershipId: string) => Promise<boolean>;
}) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [email, setEmail] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [temporaryPassword, setTemporaryPassword] = useState('');
	const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResettingPassword, setIsResettingPassword] = useState<string | null>(null);
	const [resetTempPassword, setResetTempPassword] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);

	const clearForm = () => {
		setEditingId(null);
		setEmail('');
		setDisplayName('');
		setTemporaryPassword('');
		setSelectedBranchIds([]);
		setIsSubmitting(false);
		setValidationError(null);
	};

	const beginEdit = (item: TenantStaffItem) => {
		setEditingId(item.membershipId);
		setEmail(item.email);
		setDisplayName(item.displayName);
		setTemporaryPassword('');
		setSelectedBranchIds(item.branchIds);
	};

	const toggleBranch = (branchId: string) => {
		setValidationError(null);
		setSelectedBranchIds((current) =>
			current.includes(branchId)
				? current.filter((id) => id !== branchId)
				: [...current, branchId],
		);
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-lg font-semibold text-slate-900">
						{editingId ? 'Ubah Data Staff' : 'Tambah Staff Baru'}
					</h2>
					<button
						type="button"
						onClick={onRefresh}
						disabled={loading}
						className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
					>
						{loading ? 'Memuat...' : 'Refresh'}
					</button>
				</div>
				<p className="mt-1 text-sm text-slate-500">
					{editingId
						? 'Perbarui nama atau akses outlet untuk staff ini.'
						: 'Daftarkan staff baru dengan email dan password sementara.'}
				</p>

				<form
					className="mt-4 space-y-3"
					onSubmit={async (event) => {
						event.preventDefault();
						setValidationError(null);

						if (selectedBranchIds.length === 0) {
							setValidationError('Silahkan pilih minimal satu outlet untuk memberikan akses kepada staff.');
							return;
						}

						setIsSubmitting(true);
						let success = false;
						if (editingId) {
							success = await onUpdate({
								membershipId: editingId,
								displayName,
								branchIds: selectedBranchIds,
							});
						} else {
							success = await onCreate({
								email,
								displayName,
								temporaryPassword,
								branchIds: selectedBranchIds,
							});
						}
						setIsSubmitting(false);
						if (success) {
							clearForm();
						}
					}}
				>
					<div className="grid gap-3 sm:grid-cols-2">
						<input
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="Email staff"
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-50"
							required
							disabled={!!editingId}
						/>
						<input
							type="text"
							value={displayName}
							onChange={(event) => setDisplayName(event.target.value)}
							placeholder="Nama lengkap"
							className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
					</div>

					{!editingId && (
						<input
							type="password"
							value={temporaryPassword}
							onChange={(event) => setTemporaryPassword(event.target.value)}
							placeholder="Password sementara"
							className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
							required
						/>
					)}

					<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
						<label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Akses Outlet
						</label>
						{validationError && (
							<p className="mb-2 text-xs font-medium text-red-600 animate-pulse">
								{validationError}
							</p>
						)}
						{outlets.length === 0 ? (
							<p className="text-xs text-slate-500 italic">Belum ada outlet tersedia.</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{outlets.map((outlet) => {
									const isSelected = selectedBranchIds.includes(outlet.id);
									return (
										<button
											key={outlet.id}
											type="button"
											onClick={() => toggleBranch(outlet.id)}
											className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
												isSelected
													? 'bg-slate-900 text-white'
													: 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
											}`}
										>
											{outlet.name}
										</button>
									);
								})}
							</div>
						)}
						<p className="mt-2 text-[10px] text-slate-400">
							Staff hanya dapat melihat data dan melakukan transaksi pada outlet yang dipilih.
						</p>
					</div>

					<div className="flex flex-wrap gap-2">
						<button
							type="submit"
							disabled={isSubmitting}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
						>
							{isSubmitting
								? 'Menyimpan...'
								: editingId
									? 'Simpan Perubahan'
									: 'Tambah Staff'}
						</button>
						{editingId && (
							<button
								type="button"
								onClick={clearForm}
								className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
							>
								Batal
							</button>
						)}
					</div>
				</form>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
					Daftar Staff
				</h3>

				{error && (
					<div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
						{error}
					</div>
				)}

				{!loading && staff.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">Belum ada staff terdaftar.</p>
				) : (
					<ul className="mt-4 space-y-3">
						{staff.map((item) => (
							<li
								key={item.membershipId}
								className="rounded-xl border border-slate-200 bg-slate-50 p-3"
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<p className="font-medium text-slate-900 truncate">
											{item.displayName}
										</p>
										<p className="text-xs text-slate-500 truncate">{item.email}</p>
										
										<div className="mt-2 flex flex-wrap gap-1">
											{item.branches.length === 0 ? (
												<span className="text-[10px] text-slate-400 italic">Tidak ada akses outlet</span>
											) : (
												item.branches.map((b) => (
													<span
														key={b.id}
														className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 cursor-default"
														title={b.name}
													>
														{b.code}
													</span>
												))
											)}
										</div>
									</div>
									<div className="flex flex-wrap gap-1.5">
										<button
											type="button"
											onClick={() => beginEdit(item)}
											className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => {
												setIsResettingPassword(item.membershipId);
												setResetTempPassword('');
											}}
											className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
										>
											PW
										</button>
										<button
											type="button"
											onClick={() => {
												if (confirm(`Yakin ingin menonaktifkan staff ${item.displayName}?`)) {
													onDeactivate(item.membershipId);
												}
											}}
											className="rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
										>
											Hapus
										</button>
									</div>
								</div>

								{isResettingPassword === item.membershipId && (
									<div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
										<p className="text-xs font-semibold text-slate-700 mb-2">Reset Password Staff</p>
										<div className="flex gap-2">
											<input
												type="password"
												value={resetTempPassword}
												onChange={(e) => setResetTempPassword(e.target.value)}
												placeholder="Password baru"
												className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-slate-500"
											/>
											<button
												type="button"
												onClick={async () => {
													if (!resetTempPassword) return;
													const ok = await onResetPassword({
														membershipId: item.membershipId,
														temporaryPassword: resetTempPassword
													});
													if (ok) setIsResettingPassword(null);
												}}
												className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
											>
												Simpan
											</button>
											<button
												type="button"
												onClick={() => setIsResettingPassword(null)}
												className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
											>
												Batal
											</button>
										</div>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

export function TransferModule({
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
	membershipRole,
	accessibleBranchIds,
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
	}) => Promise<boolean>;
	onChangePage: (page: number) => void;
	onChangePageSize: (size: PageSize) => void;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
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
	const sourceOptions = useMemo(() => {
		const options = [];
		const hasCentralAccess =
			membershipRole !== 'staff' ||
			outlets.some((o) => accessibleBranchIds.includes(o.id) && o.code === 'PST');

		if (hasCentralAccess) {
			options.push({
				value: 'central',
				label: 'Pusat',
				description: 'Gudang pusat',
			});
		}

		outlets
			.filter((o) => o.code !== 'PST')
			.filter(
				(o) => membershipRole !== 'staff' || accessibleBranchIds.includes(o.id),
			)
			.forEach((outlet) => {
				options.push({
					value: `outlet:${outlet.id}`,
					label: `${outlet.name} (${outlet.code})`,
					description: outlet.address,
				});
			});

		return options;
	}, [outlets, membershipRole, accessibleBranchIds]);

	const destinationOptions = useMemo(() => {
		// DESTINATIONS can be any outlet (staff can send TO anywhere)
		// but maybe exclude their source? The UI handles that with selection.
		// For consistency, let's keep all outlets as destinations but filter the list if needed.
		// Actually, let's just use all outlets for destinations.
		return outlets.map((outlet) => ({
			value: outlet.id,
			label: `${outlet.name} (${outlet.code})`,
			description: outlet.address,
		}));
	}, [outlets]);
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
	const adjustRowQty = (rowId: string, step: number) => {
		setRows((current) =>
			current.map((item) => {
				if (item.id !== rowId) {
					return item;
				}

				const nextQty = Math.max(1, parseIntegerInput(item.qtyInput, 1) + step);
				return { ...item, qtyInput: `${nextQty}` };
			}),
		);
	};

	return (
		<div className="space-y-4">
			<form
				className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
				onSubmit={async (event) => {
					event.preventDefault();

					if (!productId) {
						return;
					}

					const success = await onSubmit({
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
								className="grid gap-2 sm:grid-cols-[1fr_220px_auto]"
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

								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => adjustRowQty(row.id, -1)}
											className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
											aria-label={`Kurangi qty tujuan ${index + 1}`}
										>
											-
										</button>
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
																			: `${Math.max(1, parseIntegerInput(raw, 1))}`,
																}
															: item,
													),
												);
											}}
											className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
											required
										/>
										<button
											type="button"
											onClick={() => adjustRowQty(row.id, 1)}
											className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
											aria-label={`Tambah qty tujuan ${index + 1}`}
										>
											+
										</button>
									</div>
									<div className="flex flex-wrap gap-2">
										{[1, 5, 10].map((step) => (
											<button
												key={step}
												type="button"
												onClick={() => adjustRowQty(row.id, step)}
												className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
											>
												+{step}
											</button>
										))}
									</div>
								</div>

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

export function StockOpnameForm({
	products,
	categories,
	unitNameById,
	outlets,
	favoritesByLocation,
	usageByLocation,
	getStockByLocation,
	onToggleFavorite,
	onSubmit,
	membershipRole,
	accessibleBranchIds,
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
	}) => Promise<boolean>;
	membershipRole: MembershipRole;
	accessibleBranchIds: string[];
}) {
	const [locationValue, setLocationValue] = useState('central');
	const [productId, setProductId] = useState(products[0]?.id ?? '');
	const [isInputModalOpen, setIsInputModalOpen] = useState(false);
	const [eventLines, setEventLines] = useState<string[] | null>(null);
	const locationOptions = useMemo(() => {
		const options = [];

		const hasCentralAccess =
			membershipRole !== 'staff' ||
			outlets.some((o) => accessibleBranchIds.includes(o.id) && o.code === 'PST');

		if (hasCentralAccess) {
			options.push({
				value: 'central',
				label: 'Pusat',
				description: 'Gudang pusat',
			});
		}

		outlets
			.filter((o) => o.code !== 'PST')
			.filter((o) => membershipRole !== 'staff' || accessibleBranchIds.includes(o.id))
			.forEach((outlet) => {
				options.push({
					value: `outlet:${outlet.id}`,
					label: `${outlet.name} (${outlet.code})`,
					description: outlet.address,
				});
			});

		return options;
	}, [outlets, membershipRole, accessibleBranchIds]);

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
					Pilih lokasi pusat atau cabang/outlet dan produk, lalu lanjutkan
					input stok fisik di popup.
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
				onSave={async ({ actualStock, note, delta }) => {
					if (!selectedProduct) {
						return;
					}

					const success = await onSubmit({
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

export function SearchableOptionDropdown({
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

export function CategorySelectDropdown({
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

export function CategoryFilterDropdown({
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

export function LocationSelectDropdown({
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

export function ProductSelectDropdown({
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

export function MovementInputModal({
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
	const increaseQty = (step: number) => {
		const nextQty = Math.max(1, parseIntegerInput(qtyInput, 0) + step);
		setQtyInput(`${nextQty}`);
	};
	const decreaseQty = () => {
		const nextQty = Math.max(1, parseIntegerInput(qtyInput, 0) - 1);
		setQtyInput(`${nextQty}`);
	};

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
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={decreaseQty}
							className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							aria-label="Kurangi jumlah"
						>
							-
						</button>
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
								setQtyInput(`${Math.max(1, parseIntegerInput(raw, 1))}`);
							}}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						/>
						<button
							type="button"
							onClick={() => increaseQty(1)}
							className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							aria-label="Tambah jumlah"
						>
							+
						</button>
					</div>
					<div className="mt-2 flex flex-wrap gap-2">
						{[1, 5, 10].map((step) => (
							<button
								key={step}
								type="button"
								onClick={() => increaseQty(step)}
								className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
							>
								+{step}
							</button>
						))}
					</div>
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

export function OpnameInputModal({
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
	const increaseActualStock = (step: number) => {
		const nextStock = Math.max(
			0,
			parseIntegerInput(actualStockInput, 0) + step,
		);
		setActualStockInput(`${nextStock}`);
	};
	const decreaseActualStock = () => {
		const nextStock = Math.max(0, parseIntegerInput(actualStockInput, 0) - 1);
		setActualStockInput(`${nextStock}`);
	};

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
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={decreaseActualStock}
							className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							aria-label="Kurangi stok fisik"
						>
							-
						</button>
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
								setActualStockInput(
									`${Math.max(0, parseIntegerInput(raw, 0))}`,
								);
							}}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
						/>
						<button
							type="button"
							onClick={() => increaseActualStock(1)}
							className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							aria-label="Tambah stok fisik"
						>
							+
						</button>
					</div>
					<div className="mt-2 flex flex-wrap gap-2">
						{[1, 5, 10].map((step) => (
							<button
								key={step}
								type="button"
								onClick={() => increaseActualStock(step)}
								className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
							>
								+{step}
							</button>
						))}
					</div>
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

export function EventResultModal({
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

export function SkuGeneratingModal({ isOpen }: { isOpen: boolean }) {
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

export function PaginationControls({
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

export function MoreMenuDialog({
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
			desc: 'Kelola produk, kategori, satuan, dan outlet',
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
			key: 'report',
			label: 'Laporan',
			desc: 'Analitik stok, ekspor data, dan laporan barang',
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

export function ToastMessage({
	tone,
	message,
}: {
	tone: ToastTone;
	message: string;
}) {
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
