'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useInstitution } from '@/api/hooks';
import type { HistoryItem } from '@/api/types';
import { caseHref, fmtDateTime } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { BureauTag, ClusterStatusPill, LevelBadge, riskColor } from '@/components/common/badges';
import { DataTable } from '@/components/common/DataTable';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { ColumnChart, DonutChart } from '@/components/charts/Charts';
import { caseColumns } from '@/components/cases/caseColumns';

const DOT: Record<HistoryItem['kind'], { color: string; label: string }> = {
  action: { color: '#1A6FC4', label: 'Officer action' },
  alert: { color: '#F39C34', label: 'System alert' },
  escalation: { color: '#C0392B', label: 'Escalation' },
};

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-navy">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export default function InstitutionPage() {
  const router = useRouter();
  const params = useParams<{ aicteId: string }>();
  const id = decodeURIComponent(params.aicteId);
  const { data: inst, isLoading, error, refetch } = useInstitution(id);
  const [kind, setKind] = React.useState<'all' | HistoryItem['kind']>('all');
  const [showAll, setShowAll] = React.useState(false);

  if (isLoading) return <LoadingCards count={3} className="lg:grid-cols-3" />;
  if (error || !inst) return <ErrorState error={error} onRetry={() => refetch()} />;

  const learnt = new Set(inst.learntAliases ?? []);
  const history = inst.history.filter((h) => kind === 'all' || h.kind === kind);
  const shown = showAll ? history : history.slice(0, 25);
  const color = riskColor(inst.risk.score);

  return (
    <>
      <Link href="/institutions" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Institutions</Link>
      <div className="mb-4 mt-1 grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardBody>
            <h1 className="text-title">{inst.name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              AICTE ID <strong className="text-navy">{inst.aicteId}</strong> · {inst.type} · {inst.city}{inst.district !== inst.city ? `, ${inst.district}` : ''}, {inst.state} {inst.pincode} · {inst.region} Region · approved intake {inst.approvedIntake || '—'}
            </p>
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Known aliases</div>
              <div className="flex flex-wrap gap-1.5">
                {inst.aliases.length === 0 && <span className="text-xs text-muted">None yet — confirmed matches add the spellings here.</span>}
                {inst.aliases.map((a) => (
                  <span key={a} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${learnt.has(a) ? 'border-[#C9B8E3] bg-[#EFE9F7] text-[#5C4590]' : 'border-line bg-bg text-navy'}`}>
                    {learnt.has(a) && <Sparkles className="h-3 w-3" aria-hidden />}{a}{learnt.has(a) && <span className="text-[10px] font-semibold">learnt</span>}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Open cases" value={inst.openCases} />
              <Stat label="Bureaus involved" value={inst.bureaus.length} hint={inst.bureaus.join(', ') || 'none open'} />
              <Stat label="Cases in 3 years" value={inst.threeYearCount} />
              <Stat label="Avg disposal" value={inst.avgDisposalDays === null ? '—' : `${inst.avgDisposalDays} d`} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Risk score" subtitle="Weighted: open cases, severity, bureaus, overdue, 3-year volume" />
          <CardBody>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold" style={{ color }}>{inst.risk.score}</span>
              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${color}1A`, color }}>{inst.risk.label} risk</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {inst.risk.parts.map((p) => (
                <li key={p.label}>
                  <div className="flex justify-between"><span className="text-muted">{p.label} ({p.value})</span><span className="font-semibold tabular-nums">+{p.points}</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#E1E8F1]"><div className="h-full rounded-full bg-navy-2" style={{ width: `${Math.min(100, (p.points / 32) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Category breakdown" subtitle="All cases on record" />
          <CardBody>{inst.categoryBreakdown.length ? <DonutChart data={inst.categoryBreakdown.map((c) => ({ name: c.category, value: c.count }))} centerLabel="cases" /> : <p className="text-xs text-muted">No cases.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Cases per month" subtitle="Last 12 months, by date received" />
          <CardBody><ColumnChart data={inst.monthly} xKey="month" series={[{ key: 'count', label: 'Cases received', color: '#1A6FC4' }]} height={200} thinTicks /></CardBody>
        </Card>
      </div>

      {!!inst.clusters.length && (
        <Card className="mb-4">
          <CardHeader title="Overlap clusters" />
          <ul className="divide-y divide-line">
            {inst.clusters.map((c) => (
              <li key={c.clusterId} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
                <Link href={`/overlaps/${c.clusterId}`} className="font-semibold text-brand-blue hover:underline">{c.clusterId}</Link>
                <LevelBadge level={c.level} />
                <span className="flex-1 text-muted">{c.caseIds.join(', ')}{c.similarity ? ` · same issue? ${c.similarity.toFixed(2)}` : ''}</span>
                <ClusterStatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold">Cases ({inst.cases.length})</h2>
          <DataTable columns={caseColumns} data={inst.cases} getRowId={(r) => r.caseId} onRowClick={(r) => router.push(caseHref(r.caseId))} pageSize={10} initialHidden={{ officer: false, received: false }} emptyTitle="No cases on record" dense />
        </div>
        <Card>
          <CardHeader
            title="Action history · all bureaus"
            subtitle="Full chronological audit trail across PGRC, RB, Regional Offices and cells"
            action={
              <div className="flex gap-1">
                {(['all', 'action', 'alert', 'escalation'] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind === k ? 'bg-navy text-white' : 'bg-bg text-muted hover:text-navy'}`}>
                    {k === 'all' ? 'All' : DOT[k].label}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody>
            <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted">
              {Object.values(DOT).map((d) => <span key={d.label} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.label}</span>)}
            </div>
            {!shown.length ? <p className="text-xs text-muted">No history.</p> : (
              <ol className="relative space-y-3 border-l-2 border-line pl-5">
                {shown.map((h, i) => (
                  <li key={`${h.caseId}-${i}`} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white" style={{ background: DOT[h.kind].color }} aria-label={DOT[h.kind].label} />
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      <strong>{h.type}</strong>
                      <Link href={caseHref(h.caseId)} className="font-semibold text-brand-blue hover:underline">{h.caseId}</Link>
                      <BureauTag bureau={h.bureau} />
                    </div>
                    <div className="text-[11px] text-muted">{fmtDateTime(h.at)} · {h.by}</div>
                    {h.remarks && <p className="text-xs text-[#33435A]">{h.remarks}</p>}
                  </li>
                ))}
              </ol>
            )}
            {history.length > 25 && (
              <button onClick={() => setShowAll(!showAll)} className="mt-3 text-xs font-semibold text-brand-blue hover:underline">{showAll ? 'Show less' : `Show all ${history.length} entries`}</button>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
