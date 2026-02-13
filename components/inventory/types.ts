import { MovementType } from '@/lib/types';

export type TabKey = 'dashboard' | 'in' | 'out' | 'more';
export type PageTone = 'sky' | 'teal' | 'red' | 'orange' | 'violet';

export type MoreTab =
  | 'history'
  | 'master'
  | 'transfer'
  | 'opname'
  | 'report';
export type MasterTab = 'products' | 'categories' | 'units' | 'outlets';
export type HistoryFilter = 'all' | MovementType;
export type ToastTone = 'success' | 'error';
export type PageSize = 5 | 10 | 20;
export type AnalyticsPeriod = 'last30days' | 'monthly' | 'yearly';
export type LocationFilter = 'all' | 'central' | `outlet:${string}`;

export interface ToastState {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}
