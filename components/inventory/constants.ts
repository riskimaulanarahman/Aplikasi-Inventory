import { PageSize, PageTone } from '@/components/inventory/types';

export const PAGE_SIZE_OPTIONS: PageSize[] = [5, 10, 20];

export const PAGE_TONE_STYLES: Record<
  PageTone,
  {
    pageBackground: string;
    header: string;
    tabActive: string;
    solidButton: string;
    solidButtonHover: string;
    dialogActive: string;
    dialogActiveText: string;
  }
> = {
  sky: {
    pageBackground: 'bg-gradient-to-b from-sky-100 via-sky-50 to-white',
    header: 'bg-sky-700 shadow-[0_18px_35px_rgba(3,105,161,0.34)]',
    tabActive: 'bg-sky-600 text-white',
    solidButton: 'bg-sky-600 text-white',
    solidButtonHover: 'hover:bg-sky-700',
    dialogActive: 'border-sky-600 bg-sky-600 text-white',
    dialogActiveText: 'text-sky-100',
  },
  teal: {
    pageBackground: 'bg-gradient-to-b from-teal-100 via-teal-50 to-white',
    header: 'bg-teal-700 shadow-[0_18px_35px_rgba(15,118,110,0.34)]',
    tabActive: 'bg-teal-600 text-white',
    solidButton: 'bg-teal-600 text-white',
    solidButtonHover: 'hover:bg-teal-700',
    dialogActive: 'border-teal-600 bg-teal-600 text-white',
    dialogActiveText: 'text-teal-100',
  },
  red: {
    pageBackground: 'bg-gradient-to-b from-rose-100 via-rose-50 to-white',
    header: 'bg-rose-700 shadow-[0_18px_35px_rgba(190,24,93,0.33)]',
    tabActive: 'bg-rose-600 text-white',
    solidButton: 'bg-rose-600 text-white',
    solidButtonHover: 'hover:bg-rose-700',
    dialogActive: 'border-rose-600 bg-rose-600 text-white',
    dialogActiveText: 'text-rose-100',
  },
  orange: {
    pageBackground: 'bg-gradient-to-b from-orange-100 via-amber-50 to-white',
    header: 'bg-orange-600 shadow-[0_18px_35px_rgba(234,88,12,0.33)]',
    tabActive: 'bg-orange-500 text-white',
    solidButton: 'bg-orange-500 text-white',
    solidButtonHover: 'hover:bg-orange-600',
    dialogActive: 'border-orange-500 bg-orange-500 text-white',
    dialogActiveText: 'text-orange-100',
  },
  violet: {
    pageBackground: 'bg-gradient-to-b from-violet-100 via-fuchsia-50 to-white',
    header: 'bg-violet-700 shadow-[0_18px_35px_rgba(109,40,217,0.34)]',
    tabActive: 'bg-violet-600 text-white',
    solidButton: 'bg-violet-600 text-white',
    solidButtonHover: 'hover:bg-violet-700',
    dialogActive: 'border-violet-600 bg-violet-600 text-white',
    dialogActiveText: 'text-violet-100',
  },
};

export const DEFAULT_COORDINATES = {
  latitude: -6.2,
  longitude: 106.816666,
};
