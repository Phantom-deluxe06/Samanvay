import { BUREAUS, CATEGORIES, REGIONS, BUREAU_SHORT, STATUSES } from '@/lib/constants';
import type { BureauCode, Case, Cluster, Institution, Region } from '@/lib/types';
import { isOpen } from '@/engine/overlap';
import { riskScore } from '@/engine/risk';
import type { InstitutionRow, Overview, OverviewFilters, Report, ReportType } from './types';

const DAY = 86_400_000;

export function monthKeys(now: Date, n = 9): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) });
  }
  return out;
}
const monthOf = (iso: string) => iso.slice(0, 7);

export function applyOverviewFilters(cases: Case[], f: OverviewFilters, regionOf: (c: Case) => Region | undefined): Case[] {
  return cases.filter((c) => {
    if (f.from && c.receivedAt < f.from) return false;
    if (f.to && c.receivedAt > `${f.to}T23:59:59`) return false;
    if (f.region && f.region !== 'ALL' && regionOf(c) !== f.region) return false;
    if (f.category && f.category !== 'ALL' && c.category !== f.category) return false;
    return true;
  });
}

export function institutionRows(institutions: Institution[], cases: Case[], now: Date): InstitutionRow[] {
  const by = new Map<string, Case[]>();
  for (const c of cases) {
    if (!c.match.aicteId) continue;
    const arr = by.get(c.match.aicteId);
    if (arr) arr.push(c);
    else by.set(c.match.aicteId, [c]);
  }
  const months = monthKeys(now);
  return institutions.map((inst) => {
    const cs = by.get(inst.aicteId) ?? [];
    const open = cs.filter(isOpen);
    const spark = months.map((m) => cs.filter((c) => monthOf(c.receivedAt) === m.key).length);
    return { ...inst, openCases: open.length, totalCases: cs.length, bureaus: [...new Set(open.map((c) => c.bureau))], risk: riskScore(cs, now), spark };
  });
}

function ageBucket(days: number) {
  if (days <= 15) return '0–15 days';
  if (days <= 30) return '16–30 days';
  if (days <= 60) return '31–60 days';
  return '60+ days';
}
export const AGE_BUCKETS = ['0–15 days', '16–30 days', '31–60 days', '60+ days'];

export function buildOverview(cases: Case[], clusters: Cluster[], institutions: Institution[], now: Date, regionOf: (c: Case) => Region | undefined, scope: string): Overview {
  const open = cases.filter(isOpen);
  const t = now.getTime();
  const overdue = open.filter((c) => new Date(c.expectedDisposal).getTime() < t);
  const workload = BUREAUS.map((b) => ({ bureau: b, open: open.filter((c) => c.bureau === b).length })).filter((w) => w.open > 0).sort((a, b) => b.open - a.open);
  const ageing = AGE_BUCKETS.map((bucket) => ({ bucket, count: open.filter((c) => ageBucket((t - new Date(c.receivedAt).getTime()) / DAY) === bucket).length }));
  const ids = new Set(cases.map((c) => c.match.aicteId));
  const rows = institutionRows(institutions.filter((i) => ids.has(i.aicteId)), cases, now);
  const attention = rows.filter((r) => r.openCases > 0).sort((a, b) => b.risk.score - a.risk.score || b.openCases - a.openCases).slice(0, 10);
  const regions = REGIONS.map((region) => ({ region, open: open.filter((c) => regionOf(c) === region).length, total: cases.filter((c) => regionOf(c) === region).length }));
  const trend = monthKeys(now).map((m) => ({
    month: m.label,
    received: cases.filter((c) => monthOf(c.receivedAt) === m.key).length,
    disposed: cases.filter((c) => c.disposedAt && monthOf(c.disposedAt) === m.key).length,
  }));
  return {
    kpis: {
      total: cases.length,
      pending: open.length,
      underProcess: open.filter((c) => c.status === 'Under process' || c.status === 'Inquiry initiated').length,
      disposed: cases.length - open.length,
      beyondSla: overdue.length,
      clusters: clusters.filter((c) => c.status === 'Open' || c.status === 'Coordinating').length,
    },
    workload, ageing, attention, regions, trend, scope,
  };
}

const C = { blue: '#1A6FC4', green: '#1E8449', red: '#C0392B', saffron: '#F39C34', navy: '#0F2A52', amber: '#D68910', purple: '#7A5CA8' };

export function buildReport(type: ReportType, cases: Case[], clusters: Cluster[], institutions: Institution[], now: Date, regionOf: (c: Case) => Region | undefined): Report {
  const t = now.getTime();
  const open = (cs: Case[]) => cs.filter(isOpen);
  const overdue = (cs: Case[]) => open(cs).filter((c) => new Date(c.expectedDisposal).getTime() < t);
  const disposalDays = (cs: Case[]) => {
    const d = cs.filter((c) => c.disposedAt).map((c) => (new Date(c.disposedAt!).getTime() - new Date(c.receivedAt).getTime()) / DAY);
    return d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : 0;
  };
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  switch (type) {
    case 'institution': {
      const rows = institutionRows(institutions, cases, now).filter((r) => r.totalCases > 0).sort((a, b) => b.risk.score - a.risk.score).slice(0, 50);
      const data = rows.map((r) => ({ institution: r.name, aicteId: r.aicteId, region: r.region, open: r.openCases, total: r.totalCases, bureaus: r.bureaus.length, risk: r.risk.score }));
      return {
        type, title: 'Institution-wise report', description: 'Top 50 institutions by risk score, with open and total cases.',
        columns: [{ key: 'institution', label: 'Institution' }, { key: 'aicteId', label: 'AICTE ID' }, { key: 'region', label: 'Region' }, { key: 'open', label: 'Open', numeric: true }, { key: 'total', label: 'Total', numeric: true }, { key: 'bureaus', label: 'Bureaus', numeric: true }, { key: 'risk', label: 'Risk', numeric: true }],
        rows: data,
        chart: { kind: 'hbar', xKey: 'institution', series: [{ key: 'risk', label: 'Risk score', color: C.red }], data: data.slice(0, 12) },
      };
    }
    case 'region': {
      const data = REGIONS.map((r) => {
        const cs = cases.filter((c) => regionOf(c) === r);
        return { region: r, total: cs.length, open: open(cs).length, overdue: overdue(cs).length, disposed: cs.length - open(cs).length, disposalRate: pct(cs.length - open(cs).length, cs.length) };
      });
      return {
        type, title: 'Region-wise report', description: 'Cases by the region of the institution.',
        columns: [{ key: 'region', label: 'Region' }, { key: 'total', label: 'Total', numeric: true }, { key: 'open', label: 'Open', numeric: true }, { key: 'overdue', label: 'Beyond SLA', numeric: true }, { key: 'disposed', label: 'Disposed', numeric: true }, { key: 'disposalRate', label: 'Disposal %', numeric: true }],
        rows: data,
        chart: { kind: 'bar', xKey: 'region', series: [{ key: 'open', label: 'Open', color: C.saffron }, { key: 'disposed', label: 'Disposed', color: C.green }], data },
      };
    }
    case 'bureau': {
      const data = BUREAUS.map((b) => {
        const cs = cases.filter((c) => c.bureau === b);
        return { bureau: BUREAU_SHORT[b], total: cs.length, open: open(cs).length, overdue: overdue(cs).length, avgDays: disposalDays(cs), disposalRate: pct(cs.length - open(cs).length, cs.length) };
      }).filter((r) => r.total > 0);
      return {
        type, title: 'Bureau-wise report', description: 'Workload and performance of each Bureau / Cell / Regional Office.',
        columns: [{ key: 'bureau', label: 'Bureau / Cell' }, { key: 'total', label: 'Total', numeric: true }, { key: 'open', label: 'Open', numeric: true }, { key: 'overdue', label: 'Beyond SLA', numeric: true }, { key: 'avgDays', label: 'Avg disposal days', numeric: true }, { key: 'disposalRate', label: 'Disposal %', numeric: true }],
        rows: data,
        chart: { kind: 'bar', xKey: 'bureau', series: [{ key: 'open', label: 'Open', color: C.blue }, { key: 'overdue', label: 'Beyond SLA', color: C.red }], data },
      };
    }
    case 'status': {
      const data = STATUSES.map((s) => ({ status: s, count: cases.filter((c) => c.status === s).length }));
      data.push({ status: 'Beyond SLA (open)' as never, count: overdue(cases).length });
      return {
        type, title: 'Status-wise report', description: 'Current status of all cases in scope.',
        columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Cases', numeric: true }],
        rows: data,
        chart: { kind: 'pie', xKey: 'status', series: [{ key: 'count', label: 'Cases', color: C.blue }], data },
      };
    }
    case 'ageing': {
      const data = AGE_BUCKETS.map((bucket) => {
        const cs = open(cases).filter((c) => ageBucket((t - new Date(c.receivedAt).getTime()) / DAY) === bucket);
        return { bucket, count: cs.length, overdue: overdue(cs).length };
      });
      return {
        type, title: 'Ageing analysis', description: 'Pending cases by age since receipt.',
        columns: [{ key: 'bucket', label: 'Age' }, { key: 'count', label: 'Pending', numeric: true }, { key: 'overdue', label: 'Beyond SLA', numeric: true }],
        rows: data,
        chart: { kind: 'bar', xKey: 'bucket', series: [{ key: 'count', label: 'Pending', color: C.amber }, { key: 'overdue', label: 'Beyond SLA', color: C.red }], data },
      };
    }
    case 'disposal': {
      const data = CATEGORIES.map((cat) => {
        const cs = cases.filter((c) => c.category === cat);
        const disp = cs.filter((c) => c.disposedAt);
        const inSla = disp.filter((c) => new Date(c.disposedAt!).getTime() <= new Date(c.expectedDisposal).getTime());
        return { category: cat, total: cs.length, disposed: disp.length, disposalRate: pct(disp.length, cs.length), withinSla: pct(inSla.length, disp.length), avgDays: disposalDays(cs) };
      });
      return {
        type, title: 'Disposal rate', description: 'Disposal rate, SLA compliance and average disposal time by category.',
        columns: [{ key: 'category', label: 'Category' }, { key: 'total', label: 'Total', numeric: true }, { key: 'disposed', label: 'Disposed', numeric: true }, { key: 'disposalRate', label: 'Disposal %', numeric: true }, { key: 'withinSla', label: 'Within SLA %', numeric: true }, { key: 'avgDays', label: 'Avg days', numeric: true }],
        rows: data,
        chart: { kind: 'bar', xKey: 'category', series: [{ key: 'disposalRate', label: 'Disposal %', color: C.green }, { key: 'withinSla', label: 'Within SLA %', color: C.blue }], data },
      };
    }
    case 'overlaps': {
      const instName = new Map(institutions.map((i) => [i.aicteId, i.name]));
      const data = clusters.map((cl) => ({
        clusterId: cl.clusterId, level: cl.level === 'L1-institution' ? 'L1 · institution' : 'L2 · same issue', institution: instName.get(cl.aicteId) ?? cl.aicteId,
        cases: cl.caseIds.length, lead: BUREAU_SHORT[cl.suggestedLead], status: cl.status, similarity: cl.similarity ?? '',
      }));
      const byStatus = ['Open', 'Coordinating', 'Resolved', 'Dismissed'].map((s) => ({
        status: s, L1: clusters.filter((c) => c.status === s && c.level === 'L1-institution').length, L2: clusters.filter((c) => c.status === s && c.level === 'L2-same-issue').length,
      }));
      return {
        type, title: 'Overlapping / duplicate cases', description: 'Every cluster raised by the overlap engine and what officers decided.',
        columns: [{ key: 'clusterId', label: 'Cluster' }, { key: 'level', label: 'Level' }, { key: 'institution', label: 'Institution' }, { key: 'cases', label: 'Cases', numeric: true }, { key: 'lead', label: 'Lead' }, { key: 'status', label: 'Status' }, { key: 'similarity', label: 'Similarity' }],
        rows: data,
        chart: { kind: 'bar', xKey: 'status', series: [{ key: 'L1', label: 'L1 institution', color: C.saffron }, { key: 'L2', label: 'L2 same issue', color: C.purple }], data: byStatus },
      };
    }
    case 'monthly':
    case 'quarterly': {
      let buckets = monthKeys(now).map((m) => ({ label: m.label, keys: [m.key] }));
      if (type === 'quarterly') {
        const q = new Map<string, string[]>();
        for (const m of monthKeys(now, 12)) {
          const [y, mo] = m.key.split('-').map(Number);
          const label = `Q${Math.floor((mo - 1) / 3) + 1} ${y}`;
          q.set(label, [...(q.get(label) ?? []), m.key]);
        }
        buckets = [...q.entries()].map(([label, keys]) => ({ label, keys }));
      }
      const data = buckets.map((b) => {
        const rec = cases.filter((c) => b.keys.includes(monthOf(c.receivedAt)));
        const disp = cases.filter((c) => c.disposedAt && b.keys.includes(monthOf(c.disposedAt)));
        const inSla = disp.filter((c) => new Date(c.disposedAt!).getTime() <= new Date(c.expectedDisposal).getTime());
        return { period: b.label, received: rec.length, disposed: disp.length, withinSla: pct(inSla.length, disp.length) };
      });
      return {
        type, title: type === 'monthly' ? 'Monthly performance' : 'Quarterly performance', description: 'Cases received and disposed per period, with SLA compliance.',
        columns: [{ key: 'period', label: type === 'monthly' ? 'Month' : 'Quarter' }, { key: 'received', label: 'Received', numeric: true }, { key: 'disposed', label: 'Disposed', numeric: true }, { key: 'withinSla', label: 'Within SLA %', numeric: true }],
        rows: data,
        chart: { kind: 'line', xKey: 'period', series: [{ key: 'received', label: 'Received', color: C.blue }, { key: 'disposed', label: 'Disposed', color: C.green }], data },
      };
    }
  }
}

export function bureauRegion(b: BureauCode): Region | undefined {
  const map: Partial<Record<BureauCode, Region>> = { 'RO-S': 'Southern', 'RO-W': 'Western', 'RO-N': 'Northern', 'RO-E': 'Eastern', 'RO-C': 'Central', 'RO-SW': 'South-Western', 'RO-NW': 'North-Western', 'RO-NE': 'North-Eastern' };
  return map[b];
}
