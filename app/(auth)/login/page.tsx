import Link from 'next/link';
import { Suspense } from 'react';
import { Metadata } from 'next';
import LoginForm from './LoginForm';
import { serverApiJson } from '@/lib/api/server';
import PricingPlans from '@/components/auth/PricingPlans';

export const metadata: Metadata = {
  title: 'Login - TOGA Stok Manager',
  description: 'Masuk ke sistem TOGA Stok Manager',
};

interface Plan {
  id: string;
  name: string;
  monthly_price: string;
  yearly_price: string;
  description: string;
}

export default async function LoginPage() {
  const { payload } = await serverApiJson<{ plans: Plan[] }>('/api/public/plans');
  const plans = payload && 'plans' in payload ? payload.plans : [];

  return (
    <div className="flex min-h-screen w-full flex-col md:h-screen md:flex-row md:overflow-hidden">
      {/* Left Panel - Branding & Info */}
      <div className="relative flex w-full flex-col justify-between bg-slate-900 p-8 text-white md:w-1/2 lg:p-12 md:h-screen md:overflow-hidden">
        <div className="relative z-10">
          <div className="mb-6 flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white text-sm">
              T
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-100">TOGA Stok Manager</span>
          </div>
          
          <div className="mt-8 space-y-4 lg:mt-10">
            <h1 className="text-3xl font-bold leading-[1.15] md:text-4xl lg:text-5xl tracking-tight">
              Kelola stok dan<br />
              operasional<br />
              <span className="text-indigo-400">lebih efisien.</span>
            </h1>
            <p className="max-w-md text-base text-slate-400 leading-relaxed font-medium">
              Platform manajemen inventaris komprehensif untuk mengoptimalkan bisnis multi-cabang Anda.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 md:mt-auto pt-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-700/50"></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Pilihan Paket</h3>
            <div className="h-px flex-1 bg-slate-700/50"></div>
          </div>
          
          <PricingPlans plans={plans} />
        </div>

        {/* Decorative background circle */}
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full items-center justify-center bg-gray-50 p-8 md:w-1/2 lg:p-12 h-full overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Selamat Datang Kembali</h2>
            <p className="mt-2 text-sm text-slate-600">
              Masukan kredensial Anda untuk mengakses dashboard.
            </p>
          </div>

          <Suspense fallback={<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 animate-pulse">Memuat form login...</div>}>
            <LoginForm />
          </Suspense>

          <p className="text-center text-sm text-slate-600">
            Belum punya akun?{' '}
            <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500 underline decoration-indigo-600/30 underline-offset-4 hover:decoration-indigo-600">
              Daftar owner Outlet/Cabang
            </Link>
          </p>

          <p className="px-8 text-center text-xs text-slate-500 pb-4">
            Dengan masuk, Anda menyetujui <a href="#" className="underline underline-offset-4 hover:text-slate-900">Syarat & Ketentuan</a> dan <a href="#" className="underline underline-offset-4 hover:text-slate-900">Kebijakan Privasi</a> kami.
          </p>
        </div>
      </div>
    </div>
  );
}
