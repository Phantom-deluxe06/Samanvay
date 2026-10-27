import { CATEGORY_SEVERITY } from '@/lib/constants';
import type { Case, RiskBreakdown } from '@/lib/types';
import { isOpen } from './overlap';

const DAY = 86_400_000;

/**
 * Institution risk score 0–100: weighted sum of open cases, category severity, number of bureaus involved,
 * overdue cases and 3-year case volume.
 */
export function riskScore(cases: Case[], now: Date): RiskBreakdown {
  const threeYearsAgo = now.getTime() - 3 * 365 * DAY;
  const recent = cases.filter((c) => new Date(c.receivedAt).getTime() >= threeYearsAgo);
  const open = recent.filter(isOpen);
  const overdue = open.filter((c) => new Date(c.expectedDisposal).getTime() < now.getTime());
  const bureaus = new Set(open.map((c) => c.bureau));
  const severity = open.reduce((s, c) => s + CATEGORY_SEVERITY[c.category], 0);

  const parts = [
    { label: 'Open cases', value: open.length, points: Math.min(32, open.length * 8) },
    { label: 'Severity of open issues', value: Math.round(severity * 10) / 10, points: Math.min(20, Math.round(severity * 3)) },
    { label: 'Bureaus involved', value: bureaus.size, points: Math.min(20, Math.max(0, bureaus.size - 1) * 10) },
    { label: 'Overdue cases', value: overdue.length, points: Math.min(18, overdue.length * 6) },
    { label: 'Cases in 3 years', value: recent.length, points: Math.min(10, Math.round(recent.length * 1.5)) },
  ];
  const score = Math.min(100, parts.reduce((s, p) => s + p.points, 0));
  const label = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low';
  return { score, label, parts };
}
