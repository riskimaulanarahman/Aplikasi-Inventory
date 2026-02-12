import type { PageTone, TabKey } from '@/components/inventory/types';

interface BottomNavProps {
  activeTab: TabKey;
  tone: PageTone;
  onChange: (tab: TabKey) => void;
  onOpenMoreMenu: () => void;
}

const mobileActiveByTone: Record<PageTone, string> = {
  sky: 'bg-sky-600 text-white shadow-sm',
  teal: 'bg-teal-600 text-white shadow-sm',
  red: 'bg-rose-600 text-white shadow-sm',
  orange: 'bg-orange-500 text-white shadow-sm',
  violet: 'bg-violet-600 text-white shadow-sm',
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dasbor' },
  { key: 'in', label: 'Masuk' },
  { key: 'out', label: 'Keluar' },
  { key: 'more', label: 'Lainnya' },
];

export default function BottomNav({ activeTab, tone, onChange, onOpenMoreMenu }: BottomNavProps) {
  return (
    <nav className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.25rem)] -translate-x-1/2 sm:hidden">
      <ul className="grid grid-cols-4 rounded-[1.8rem] border border-slate-200/80 bg-white/85 p-1 shadow-[0_10px_35px_rgba(15,23,42,0.20)] backdrop-blur-xl">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <li key={tab.key}>
              <button
                type="button"
                onClick={() => {
                  if (tab.key === 'more') {
                    onOpenMoreMenu();
                    return;
                  }

                  onChange(tab.key);
                }}
                className={`flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                  isActive ? mobileActiveByTone[tone] : 'text-slate-500'
                }`}
              >
                <span aria-hidden>
                  <TabIcon tab={tab.key} />
                </span>
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabIcon({ tab }: { tab: TabKey }) {
  const classes = 'h-[18px] w-[18px]';

  if (tab === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={classes}>
        <rect x="3" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="11" width="7" height="10" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (tab === 'in') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={classes}>
        <path d="M12 20V4" />
        <path d="m6 10 6-6 6 6" />
      </svg>
    );
  }

  if (tab === 'out') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={classes}>
        <path d="M12 4v16" />
        <path d="m6 14 6 6 6-6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={classes}>
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  );
}
