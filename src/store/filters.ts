'use client';
import { create } from 'zustand';
import type { CaseFilters, OverviewFilters } from '@/api/types';

interface FiltersState {
  cases: CaseFilters;
  overview: OverviewFilters;
  setCases: (f: Partial<CaseFilters>) => void;
  resetCases: (f?: CaseFilters) => void;
  setOverview: (f: Partial<OverviewFilters>) => void;
}

export const useFilters = create<FiltersState>((set) => ({
  cases: {},
  overview: {},
  setCases: (f) => set((s) => ({ cases: { ...s.cases, ...f } })),
  resetCases: (f = {}) => set({ cases: f }),
  setOverview: (f) => set((s) => ({ overview: { ...s.overview, ...f } })),
}));
