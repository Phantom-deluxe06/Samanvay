'use client';
import type { CaseMutationResult } from '@/api/types';
import { useDemo } from '@/store/demo';
import { toast } from '@/components/ui/toast';

/**
 * Tell the officer what the overlap engine found after a case was registered, re-linked or transferred.
 * - Another open case involved → toast + the "Coordination Required" modal.
 * - Only a disposed same-issue complaint → an informational "repeat complaint" toast.
 * Returns true when anything was announced.
 */
export function announceOverlap(res: CaseMutationResult, go: (href: string) => void): boolean {
  const o = res.overlap;
  if (!o) return false;
  if (o.coordinationRequired) {
    toast({ tone: 'overlap', title: 'Potential Overlapping Cases – Coordination Required', description: `${res.case.caseId} joins ${o.related.length} other case(s) on ${o.institution.name}.` });
    useDemo.getState().showOverlap({ ...o, caseId: res.case.caseId });
    return true;
  }
  const cl = o.clusters[0];
  const prev = o.related[0];
  toast({
    tone: 'info',
    title: 'Repeat complaint — same issue raised before',
    description: `${res.case.caseId} matches ${prev?.caseId ?? 'an earlier complaint'} (${prev?.status.toLowerCase() ?? 'closed'}) on ${o.institution.name} · same issue? ${cl?.similarity?.toFixed(2) ?? '—'}. No coordination needed — the earlier case is closed.`,
    action: cl ? { label: 'View link', onClick: () => go(`/overlaps/${cl.clusterId}`) } : undefined,
  });
  return true;
}
