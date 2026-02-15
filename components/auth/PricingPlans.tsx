'use client';

interface Plan {
  id: string;
  name: string;
  monthly_price: string;
  yearly_price: string;
  description: string;
}

export default function PricingPlans({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-800/50 p-6 text-center border border-slate-700/50 dashed">
        <p className="text-sm text-slate-500">Belum ada paket tersedia saat ini.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      {plans.map((plan) => {
        const monthly = parseInt(plan.monthly_price);
        const yearly = parseInt(plan.yearly_price);
        const yearlyFromMonthly = monthly * 12;
        const savingsPercent = Math.round(((yearlyFromMonthly - yearly) / yearlyFromMonthly) * 100);

        return (
          <div 
            key={plan.id} 
            className="group relative rounded-2xl bg-white/5 p-5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-indigo-500/50"
          >
            {savingsPercent > 0 && (
              <div className="absolute -top-3 -right-2 z-10">
                <div className="bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg animate-bounce">
                  HEMAT {savingsPercent}%
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-indigo-400 tracking-tight">{plan.name}</h4>
                <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-1 leading-relaxed">
                  {plan.description || 'Fitur lengkap untuk bisnis Anda.'}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <div className="text-right bg-indigo-500/10 rounded-lg p-2 border border-indigo-500/20">
                  <div className="text-sm font-black text-indigo-300 leading-none">
                    <span className="text-[9px] font-medium text-indigo-400 mr-1 italic">Rp</span>
                    {yearly.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[9px] font-bold text-indigo-500/60 uppercase tracking-widest whitespace-nowrap">
                    / tahun
                  </span>
                </div>
                <div className="text-right opacity-60">
                  <div className="text-sm font-bold text-white leading-none">
                    <span className="text-[10px] font-medium text-slate-500 mr-1 italic">Rp</span>
                    {monthly.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">/ bulan</span>
                </div>
              </div>
            </div>
            {/* Subtle hover effect indicator */}
            <div className="absolute bottom-0 left-0 h-1 w-0 bg-indigo-500 transition-all group-hover:w-full rounded-b-2xl"></div>
          </div>
        );
      })}
    </div>
  );
}
