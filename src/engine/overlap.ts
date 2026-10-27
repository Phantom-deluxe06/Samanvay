import type { BureauCode, Case } from '@/lib/types';
import { issueSimilarity, type Idf } from './similarity';

export const isOpen = (c: Pick<Case, 'status'>) => c.status !== 'Disposed';

export interface L2Hit { case: Case; similarity: number }
export interface OverlapResult { l1: Case[]; l2: L2Hit[] }

/**
 * L1: other open cases on the same institution in a different bureau.
 * L2: other cases on the same institution whose complaint text describes the same issue (similarity ≥ threshold).
 */
export function detectOverlaps(c: Case, allCases: Case[], opts: { idf: Idf; l2Threshold?: number }): OverlapResult {
  const id = c.match.aicteId;
  if (!id) return { l1: [], l2: [] };
  const threshold = opts.l2Threshold ?? 0.75;
  const same = allCases.filter((o) => o.caseId !== c.caseId && o.match.aicteId === id);
  const l1 = isOpen(c) ? same.filter((o) => isOpen(o) && o.bureau !== c.bureau) : [];
  const l2: L2Hit[] = [];
  for (const o of same) {
    if (!isOpen(c) && !isOpen(o)) continue;
    const similarity = issueSimilarity(c.description, o.description, opts.idf, c.category === o.category);
    if (similarity >= threshold) l2.push({ case: o, similarity });
  }
  l2.sort((a, b) => b.similarity - a.similarity);
  return { l1, l2 };
}

/** The regulatory-action bureau (RB) leads when involved; otherwise the bureau holding the oldest open case. */
export function suggestLead(cases: Pick<Case, 'bureau' | 'receivedAt' | 'status'>[]): BureauCode {
  const open = cases.filter(isOpen);
  const pool = open.length ? open : cases;
  if (pool.some((c) => c.bureau === 'RB')) return 'RB';
  const oldest = [...pool].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
  return oldest?.bureau ?? 'PGRC';
}

export function leadReason(lead: BureauCode, cases: Pick<Case, 'bureau' | 'receivedAt' | 'status'>[]): string {
  if (lead === 'RB' && cases.some((c) => c.bureau === 'RB')) return 'Regulation Bureau holds regulatory-action powers over the institution';
  return 'Bureau holding the oldest open case in the cluster';
}
