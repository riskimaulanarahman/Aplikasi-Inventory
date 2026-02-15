'use client';

import { useState, useRef, useEffect } from 'react';
import { useBilling, InvoiceData, PlanData } from '@/lib/hooks/useBilling';

interface BillingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  subscriptionStatus?: string | null;
  onSuccess?: () => void;
}

export default function BillingDialog({
  isOpen,
  onClose,
  tenantSlug,
  subscriptionStatus,
  onSuccess,
}: BillingDialogProps) {
  const { createInvoice, getUploadUrl, uploadProof, submitPayment, getPublicPlans, isLoading, error } = useBilling(tenantSlug);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [bankName, setBankName] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void getPublicPlans().then((data) => {
        setPlans(data);
        if (data.length > 0) {
          setSelectedPlanId(data[0].id);
        }
      });
    } else {
      // Reset state when closing
      setStep(1);
      setInvoice(null);
      setProofFile(null);
      setBankName('');
      setNote('');
      setLocalError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateInvoice = async () => {
    if (!selectedPlanId) return;
    setLocalError(null);
    const data = await createInvoice(cycle, selectedPlanId);
    if (data) {
      setInvoice(data);
      setTransferAmount(data.amount.toString());
      setStep(2);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleSubmitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !proofFile || !bankName || !transferAmount) return;

    setIsSubmitting(true);
    setLocalError(null);

    try {
      // 1. Get upload URL
      const uploadIntent = await getUploadUrl(proofFile.name.split('.').pop());
      if (!uploadIntent) throw new Error('Gagal menyiapkan pengunggahan.');

      // 2. Upload file
      const uploadResult = await uploadProof(uploadIntent.uploadToken, proofFile);
      if (!uploadResult) throw new Error('Gagal mengunggah bukti pembayaran.');

      // 3. Submit payment
      const submission = await submitPayment({
        invoiceId: invoice.id,
        proofPath: uploadResult.path,
        transferAmount: parseFloat(transferAmount),
        bankName,
        note,
      });

      if (submission) {
        setStep(3);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 p-5 backdrop-blur-md">
          <h3 className="text-xl font-bold text-slate-900">
            {step === 1 && 'Pilih Paket Langganan'}
            {step === 2 && 'Konfirmasi Pembayaran'}
            {step === 3 && 'Pembayaran Terkirim'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {(error || localError) && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              {error || localError}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                Layanan Anda saat ini berstatus <strong className="uppercase text-slate-900">{subscriptionStatus || 'Trial'}</strong>. 
                Pilih paket untuk melanjutkan penggunaan fitur tanpa hambatan.
              </p>

              {plans.length === 0 && isLoading ? (
                <div className="flex justify-center py-12">
                   <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                </div>
              ) : (
                <>
                  {plans.length > 1 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pilih Tipe Paket</span>
                      <div className="flex flex-wrap gap-2">
                        {plans.map((plan) => (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelectedPlanId(plan.id)}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                              selectedPlanId === plan.id
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {plan.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPlan && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setCycle('monthly')}
                        className={`relative flex flex-col items-center rounded-2xl border-2 p-6 transition-all ${
                          cycle === 'monthly'
                            ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                            : 'border-slate-100 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-500">Bulanan</span>
                        <span className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(selectedPlan.monthly_price)}</span>
                        <span className="text-[10px] text-slate-400"> / bulan</span>
                        {cycle === 'monthly' && (
                          <div className="absolute -right-2 -top-2 rounded-full bg-indigo-600 p-1 text-white shadow-lg">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setCycle('yearly')}
                        className={`relative flex flex-col items-center rounded-2xl border-2 p-6 transition-all ${
                          cycle === 'yearly'
                            ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                            : 'border-slate-100 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="absolute -top-3 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold text-white shadow-md">
                          HEMAT 17%
                        </div>
                        <span className="text-sm font-semibold text-slate-500">Tahunan</span>
                        <span className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(selectedPlan.yearly_price)}</span>
                        <span className="text-[10px] text-slate-400"> / tahun</span>
                        {cycle === 'yearly' && (
                          <div className="absolute -right-2 -top-2 rounded-full bg-indigo-600 p-1 text-white shadow-lg">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    </div>
                  )}

                  {selectedPlan && (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Keuntungan Paket {selectedPlan.name}:
                      </h4>
                      <p className="mt-1 text-[10px] text-slate-400">{selectedPlan.description}</p>
                      <ul className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                        <li className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-slate-400"></div>
                          Manajemen stok unlimited
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-slate-400"></div>
                          Multi-outlet / cabang aktif
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-slate-400"></div>
                          Laporan stok real-time
                        </li>
                      </ul>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isLoading || !selectedPlanId}
                    onClick={handleCreateInvoice}
                    className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Memproses...' : 'Lanjutkan ke Pembayaran'}
                  </button>
                </>
              )}
            </div>
          )}

          {step === 2 && invoice && (
            <form onSubmit={handleSubmitConfirmation} className="space-y-6">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Instruksi Transfer</span>
                  <span className="text-xs text-slate-400">#{invoice.invoice_number}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-indigo-100/50 pb-2">
                    <span className="text-sm text-slate-500">Bank Tujuan</span>
                    <span className="text-sm font-bold text-slate-900">BCA (DUMMY)</span>
                  </div>
                  <div className="flex justify-between border-b border-indigo-100/50 pb-2">
                    <span className="text-sm text-slate-500">No. Rekening</span>
                    <span className="text-sm font-bold text-slate-900">1234-5678-90</span>
                  </div>
                  <div className="flex justify-between border-b border-indigo-100/50 pb-2">
                    <span className="text-sm text-slate-500">Atas Nama</span>
                    <span className="text-sm font-bold text-slate-900">TOGA STOK MANAGER</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-sm text-slate-500">Total Transfer</span>
                    <span className="text-lg font-black text-indigo-700">
                      {formatCurrency(invoice.amount)}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] italic text-rose-500">
                    * Mohon transfer tepat sampai 3 digit terakhir jika ada kode unik.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Konfirmasi Upload Bukti</span>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all ${
                      proofFile ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-slate-50 hover:border-indigo-300'
                    }`}
                  >
                    {proofFile ? (
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="mt-2 text-sm font-semibold text-slate-700">{proofFile.name}</p>
                        <p className="text-xs text-indigo-600">Klik untuk ganti file</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="mt-2 text-sm font-semibold text-slate-700">Klik untuk upload foto/screenshot</p>
                        <p className="text-xs text-slate-400 text-slate-500">JPG, PNG atau PDF (Maks. 5MB)</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      accept="image/*,.pdf"
                    />
                  </div>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Nama Bank Pengirim</span>
                    <input
                      type="text"
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Contoh: BCA, Mandiri"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Nominal Transfer</span>
                    <input
                      type="number"
                      required
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Catatan (Opsional)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Contoh: Pembayaran outlet pusat"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !proofFile || !bankName || !transferAmount}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Mengirim...' : 'Kirim Konfirmasi'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
                >
                  Kembali pilih paket
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="mt-6 text-xl font-bold text-slate-900">Konfirmasi Diterima!</h4>
              <p className="mt-3 text-sm text-slate-600">
                Terima kasih. Tim kami akan melakukan verifikasi pembayaran Anda dalam waktu 1x24 jam kerja. 
                Status langganan akan otomatis diperbarui setelah diverifikasi.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-10 w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800"
              >
                Kembali ke Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
