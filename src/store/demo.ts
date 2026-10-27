'use client';
import { create } from 'zustand';
import type { CreateCaseInput, OverlapNotice } from '@/api/types';

export type IntakePrefill = Partial<CreateCaseInput> & { tourKey?: string };

interface DemoState {
  panelOpen: boolean;
  tourStep: number | null;
  /** Intake sheet state, shared so the guided demo can open and prefill it. */
  intakeOpen: boolean;
  intakePrefill: IntakePrefill | null;
  /** Overlap alert modal (the key demo moment). */
  overlapAlert: (OverlapNotice & { caseId: string }) | null;
  paletteOpen: boolean;
  /** Case ids registered during the guided demo (so later steps can check what happened). */
  tourCases: Record<string, string>;
  setPanel: (open: boolean) => void;
  setTourStep: (n: number | null) => void;
  openIntake: (prefill?: IntakePrefill | null) => void;
  closeIntake: () => void;
  showOverlap: (n: (OverlapNotice & { caseId: string }) | null) => void;
  setPalette: (open: boolean) => void;
  setTourCase: (key: string, caseId: string) => void;
  clearTourCases: () => void;
}

export const useDemo = create<DemoState>((set) => ({
  panelOpen: false,
  tourStep: null,
  intakeOpen: false,
  intakePrefill: null,
  overlapAlert: null,
  paletteOpen: false,
  tourCases: {},
  setPanel: (panelOpen) => set({ panelOpen }),
  setTourStep: (tourStep) => set({ tourStep }),
  openIntake: (intakePrefill = null) => set({ intakeOpen: true, intakePrefill }),
  closeIntake: () => set({ intakeOpen: false, intakePrefill: null }),
  showOverlap: (overlapAlert) => set({ overlapAlert }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setTourCase: (key, caseId) => set((s) => ({ tourCases: { ...s.tourCases, [key]: caseId } })),
  clearTourCases: () => set({ tourCases: {} }),
}));
