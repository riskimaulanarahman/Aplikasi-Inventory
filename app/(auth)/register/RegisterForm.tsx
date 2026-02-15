'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApiFetch } from '@/lib/api/client';
import { setClientAuthToken } from '@/lib/auth/token.client';

export default function RegisterForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantType, setTenantType] = useState<'company' | 'individual'>('company');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const registerResponse = await clientApiFetch('/api/auth/register-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          tenantName,
          tenantType,
          email,
          phone: phone || undefined,
          password,
        }),
      });

      const registerPayload = await registerResponse.json().catch(() => ({}));

      if (!registerResponse.ok) {
        setError(registerPayload?.error ?? 'Registrasi gagal');
        setIsSubmitting(false);
        return;
      }

      const loginResponse = await clientApiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginPayload = await loginResponse.json().catch(() => ({}));
      if (!loginResponse.ok || !loginPayload?.token) {
        setError(`Akun berhasil dibuat, tetapi login gagal: ${loginPayload?.error ?? 'Unknown error'}`);
        setIsSubmitting(false);
        return;
      }

      setClientAuthToken(loginPayload.token);
      router.replace(`/t/${registerPayload.tenantSlug}`);
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung ke API.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Nama Lengkap</label>
          <input 
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" 
            placeholder="Masukkan nama Anda"
            value={displayName} 
            onChange={(event) => setDisplayName(event.target.value)} 
            required 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Nama Outlet/Cabang</label>
          <input 
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" 
            placeholder="Contoh: Toko Berkah"
            value={tenantName} 
            onChange={(event) => setTenantName(event.target.value)} 
            required 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Tipe Outlet</label>
          <select 
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none appearance-none" 
            value={tenantType} 
            onChange={(event) => setTenantType(event.target.value as 'company' | 'individual')}
          >
            <option value="company">Perusahaan (Company)</option>
            <option value="individual">Perorangan (Individual)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
          <input 
            type="email" 
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" 
            placeholder="nama@email.com"
            value={email} 
            onChange={(event) => setEmail(event.target.value)} 
            required 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Telepon (opsional)</label>
          <input 
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" 
            placeholder="0812xxxxxxxx"
            value={phone} 
            onChange={(event) => setPhone(event.target.value)} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
          <input 
            type="password" 
            minLength={8} 
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" 
            placeholder="Minimal 8 karakter"
            value={password} 
            onChange={(event) => setPassword(event.target.value)} 
            required 
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      ) : null}

      <button 
        type="submit" 
        disabled={isSubmitting} 
        className="group relative w-full overflow-hidden rounded-xl bg-indigo-600 px-4 py-4 text-sm font-bold text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isSubmitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Memproses...
            </>
          ) : (
            <>
              Daftar Sekarang
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </span>
      </button>
    </form>
  );
}
