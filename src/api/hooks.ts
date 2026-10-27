'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/store/session';
import type { Settings } from '@/lib/types';
import { api } from './client';
import type {
  AuditFilters, CaseActionInput, CaseFilters, CasePatch, ClusterDecision, CreateCaseInput, NewInstitutionInput, OverviewFilters, ReportType,
} from './types';

/** Every query key carries the session so a role switch never shows another role's cached data. */
function useScope() {
  const s = useSession((x) => x.session);
  return s ? `${s.role}:${s.region ?? ''}:${s.officer}` : 'anon';
}

export function useCases(filters: CaseFilters = {}, enabled = true) {
  const scope = useScope();
  return useQuery({ queryKey: ['cases', scope, filters], queryFn: () => api.listCases(filters), placeholderData: keepPreviousData, enabled });
}
export function useCase(id: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['case', scope, id], queryFn: () => api.getCase(id), retry: false });
}
export function useClusters() {
  const scope = useScope();
  return useQuery({ queryKey: ['clusters', scope], queryFn: () => api.listClusters() });
}
export function useCluster(id: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['cluster', scope, id], queryFn: () => api.getCluster(id), retry: false, enabled: !!id });
}
export function useInstitutions(q?: string, enabled = true) {
  const scope = useScope();
  return useQuery({ queryKey: ['institutions', scope, q ?? ''], queryFn: () => api.listInstitutions(q), placeholderData: keepPreviousData, enabled });
}
export function useInstitution(id: string) {
  const scope = useScope();
  return useQuery({ queryKey: ['institution', scope, id], queryFn: () => api.getInstitution(id), retry: false });
}
export function useQueue() {
  const scope = useScope();
  return useQuery({ queryKey: ['queue', scope], queryFn: () => api.listQueue() });
}
export function useOverview(f: OverviewFilters = {}) {
  const scope = useScope();
  return useQuery({ queryKey: ['overview', scope, f], queryFn: () => api.getOverview(f), placeholderData: keepPreviousData });
}
export function useReport(type: ReportType, f: OverviewFilters = {}) {
  const scope = useScope();
  return useQuery({ queryKey: ['report', scope, type, f], queryFn: () => api.getReports(type, f), placeholderData: keepPreviousData });
}
export function useModelQuality() {
  const scope = useScope();
  return useQuery({ queryKey: ['quality', scope], queryFn: () => api.getModelQuality() });
}
export function useSla() {
  const scope = useScope();
  return useQuery({ queryKey: ['sla', scope], queryFn: () => api.getSla() });
}
export function useAudit(f: AuditFilters = {}) {
  const scope = useScope();
  return useQuery({ queryKey: ['audit', scope, f], queryFn: () => api.listAudit(f), placeholderData: keepPreviousData });
}
export function useSettings() {
  const scope = useScope();
  return useQuery({ queryKey: ['settings', scope], queryFn: () => api.getSettings() });
}
export function useNotifications() {
  const scope = useScope();
  return useQuery({ queryKey: ['notifications', scope], queryFn: () => api.listNotifications(), refetchInterval: 15_000 });
}
export function useCounts() {
  const scope = useScope();
  return useQuery({ queryKey: ['counts', scope], queryFn: () => api.getCounts(), refetchInterval: 15_000 });
}
export function useClock() {
  return useQuery({ queryKey: ['clock'], queryFn: () => api.getClock(), refetchInterval: 30_000 });
}

/** Mutations refresh everything: the mock DB is small and cross-page consistency matters more than cache precision. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useCreateCase() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (input: CreateCaseInput) => api.createCase(input), onSuccess: inv });
}
export function useCaseAction(id: string) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (a: CaseActionInput) => api.addAction(id, a), onSuccess: inv });
}
export function useUpdateCase(id: string) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: CasePatch) => api.updateCase(id, p), onSuccess: inv });
}
export function useDecideCluster(id: string) {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (d: ClusterDecision) => api.decideCluster(id, d), onSuccess: inv });
}
export function useConfirmMatch() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (v: { caseId: string; aicteId: string }) => api.confirmMatch(v.caseId, v.aicteId), onSuccess: inv });
}
export function useUnlinkMatch() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (v: { caseId: string; reason: string }) => api.unlinkMatch(v.caseId, v.reason), onSuccess: inv });
}
export function useCreateInstitution() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (v: NewInstitutionInput) => api.createInstitution(v), onSuccess: inv });
}
export function useUpdateSettings() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (p: Partial<Settings>) => api.updateSettings(p), onSuccess: inv });
}
export function useMarkRead() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (ids?: string[]) => api.markNotificationsRead(ids), onSuccess: inv });
}
export function useVerifyAudit() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: () => api.verifyAudit(), onSuccess: inv });
}
export function useAdvanceClock() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (days: number) => api.advanceClock(days), onSuccess: inv });
}
export function useResetDemo() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (scenario: 'full' | 'demo' = 'full') => api.resetDemo(scenario), onSuccess: inv });
}
