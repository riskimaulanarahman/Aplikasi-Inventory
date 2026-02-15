'use client';

import { useState, useEffect } from 'react';
import { PlanData } from '@/lib/hooks/usePlatformPlans';

interface PlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlanFormData) => Promise<void>;
  plan?: PlanData | null;
  isLoading?: boolean;
}

export interface PlanFormData {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  isActive: boolean;
}

export default function PlanDialog({ isOpen, onClose, onSubmit, plan, isLoading }: PlanDialogProps) {
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    monthlyPrice: '',
    yearlyPrice: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (plan) {
      setFormData({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description || '',
        monthlyPrice: plan.monthly_price,
        yearlyPrice: plan.yearly_price,
        isActive: plan.is_active,
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        monthlyPrice: '',
        yearlyPrice: '',
        isActive: true,
      });
    }
    setErrors({});
  }, [plan, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!plan && !formData.code?.trim()) {
      newErrors.code = 'Code is required';
    }
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.monthlyPrice || parseFloat(formData.monthlyPrice) <= 0) {
      newErrors.monthlyPrice = 'Monthly price must be greater than 0';
    }
    if (!formData.yearlyPrice || parseFloat(formData.yearlyPrice) <= 0) {
      newErrors.yearlyPrice = 'Yearly price must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    await onSubmit(formData);
  };

  const handleChange = (field: keyof PlanFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {plan ? 'Edit Plan' : 'Create New Plan'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            {/* Code - only for new plans */}
            {!plan && (
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="code"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${
                    errors.code ? 'border-red-500' : 'border-slate-300'
                  } px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                  placeholder="e.g., BASIC, PREMIUM"
                  disabled={isLoading}
                />
                {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`mt-1 block w-full rounded-lg border ${
                  errors.name ? 'border-red-500' : 'border-slate-300'
                } px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                placeholder="e.g., Basic Plan"
                disabled={isLoading}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Plan description..."
                disabled={isLoading}
              />
            </div>

            {/* Monthly Price */}
            <div>
              <label htmlFor="monthlyPrice" className="block text-sm font-medium text-slate-700">
                Monthly Price (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="monthlyPrice"
                value={formData.monthlyPrice}
                onChange={(e) => handleChange('monthlyPrice', e.target.value)}
                className={`mt-1 block w-full rounded-lg border ${
                  errors.monthlyPrice ? 'border-red-500' : 'border-slate-300'
                } px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                placeholder="100000"
                min="0"
                step="1000"
                disabled={isLoading}
              />
              {errors.monthlyPrice && <p className="mt-1 text-xs text-red-500">{errors.monthlyPrice}</p>}
            </div>

            {/* Yearly Price */}
            <div>
              <label htmlFor="yearlyPrice" className="block text-sm font-medium text-slate-700">
                Yearly Price (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="yearlyPrice"
                value={formData.yearlyPrice}
                onChange={(e) => handleChange('yearlyPrice', e.target.value)}
                className={`mt-1 block w-full rounded-lg border ${
                  errors.yearlyPrice ? 'border-red-500' : 'border-slate-300'
                } px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                placeholder="1000000"
                min="0"
                step="1000"
                disabled={isLoading}
              />
              {errors.yearlyPrice && <p className="mt-1 text-xs text-red-500">{errors.yearlyPrice}</p>}
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isLoading}
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-slate-700">
                Active
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
