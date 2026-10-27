'use client';
import * as React from 'react';
import { FlaskConical, X } from 'lucide-react';
import { useModelQuality, useReport } from '@/api/hooks';
import type { ModelQuality, Report, ReportType } from '@/api/types';
import { CATEGORIES, REGIONS } from '@/lib/constants';
import type { Category, Region } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFilters } from '@/store/filters';
import { Button, Card, CardBody, CardHeader, Input, Skeleton } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { ExportMenu } from '@/components/common/ExportMenu';
import { ErrorState, PageHeader } from '@/components/common/states';
import { ColumnChart, DonutChart, HBarChart, LineTrendChart } from '@/components/charts/Charts';

const REPORTS: { type: ReportType; label: string }[] = [
  { type: 'institution', label: 'Institution-wise' },
  { type: 'region', label: 'Region-wise' },
  { type: 'bureau', label: 'Bureau-wise' },
  { type: 'status', label: 'Status-wise' },
  { type: 'ageing', label: 'Ageing analysis' },
  { type: 'disposal', label: 'Disposal rate' },
  { type: 'overlaps', label: 'Overlapping / duplicate' },
  { type: 'monthly', label: 'Monthly performance' },
  { type: 'quarterly', label: 'Quarterly performance' },
];

function ReportChart({ r }: { r: Report }) {
  const c = r.chart;
  const data = c.data as Record<string, string | number>[];
  if (c.kind === 'hbar') return <HBarChart data={data} labelKey={c.xKey} valueKey={c.series[0].key} valueLabel={c.series[0].label} color={c.series[0].color} />;
  if (c.kind === 'line') return <LineTrendChart data={data} xKey={c.xKey} series={c.series} height={280} />;
  if (c.kind === 'pie') return <DonutChart data={data.map((d) => ({ name: String(d[c.xKey]), value: Number(d[c.series[0].key]) }))} height={220} centerLabel="cases" />;
  return <ColumnChart data={data} xKey={c.xKey} series={c.series} height={300} angleTicks={data.length > 6} />;
}

function Pct({ v, good = 'high' }: { v: number; good?: 'high' | 'low' }) {
  const ok = good === 'high' ? v >= 85 : v <= 2;
  return <span className={cn('text-2xl font-bold', ok ? 'text-brand-green' : 'text-[#A36A00]')}>{v}%</span>;
}

function QualityCard({ q, loading }: { q?: ModelQuality; loading: boolean }) {
  return (
    <Card className="border-[#C9B8E3]">
      <CardHeader
        title={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-[#7A5CA8]" /> Model quality (synthetic test set)</span>}
        subtitle="Measured on synthetic data against the seed’s hidden ground truth — not a claim about real-world performance. Re-computed live with the current settings."
      />
      <CardBody>
        {loading || !q ? <Skeleton className="h-28" /> : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div><div className="text-xs text-muted">Institution-match accuracy</div><Pct v={q.matchAccuracy} /><div className="text-[11px] text-muted">of auto-linked cases (≥ {q.threshold}%)</div></div>
            <div><div className="text-xs text-muted">Auto-link rate</div><Pct v={q.autoLinkRate} /><div className="text-[11px] text-muted">{q.casesEvaluated} complaints evaluated</div></div>
            <div><div className="text-xs text-muted">False-link rate on look-alikes</div><Pct v={q.lookalikeFalseLinkRate} good="low" /><div className="text-[11px] text-muted">{q.lookalikeCases} look-alike complaints</div></div>
            <div><div className="text-xs text-muted">L1 overlap recall</div><Pct v={q.l1Recall} /><div className="text-[11px] text-muted">{q.l1Found}/{q.l1Planted} planted clusters</div></div>
            <div><div className="text-xs text-muted">L2 same-issue recall</div><Pct v={q.l2Recall} /><div className="text-[11px] text-muted">{q.l2Found}/{q.l2Planted} planted pairs</div></div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const [type, setType] = React.useState<ReportType>('bureau');
  const { overview: f, setOverview } = useFilters();
  const { data: r, isLoading, isFetching, error, refetch } = useReport(type, f);
  const quality = useModelQuality();
  const active = !!(f.from || f.to || (f.region && f.region !== 'ALL') || (f.category && f.category !== 'ALL'));
  const filterText = [f.from && `from ${f.from}`, f.to && `to ${f.to}`, f.region && f.region !== 'ALL' && f.region, f.category && f.category !== 'ALL' && f.category].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Each report has a chart and a table, and exports to PDF (with the Samanvay header) or Excel."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" aria-label="From date" value={f.from ?? ''} onChange={(e) => setOverview({ from: e.target.value || undefined })} className="w-[140px]" />
            <Input type="date" aria-label="To date" value={f.to ?? ''} onChange={(e) => setOverview({ to: e.target.value || undefined })} className="w-[140px]" />
            <div className="w-36"><Select ariaLabel="Region" value={f.region ?? 'ALL'} onValueChange={(v) => setOverview({ region: v as Region })} options={[{ value: 'ALL', label: 'All regions' }, ...REGIONS.map((x) => ({ value: x, label: x }))]} /></div>
            <div className="w-44"><Select ariaLabel="Category" value={f.category ?? 'ALL'} onValueChange={(v) => setOverview({ category: v as Category })} options={[{ value: 'ALL', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} /></div>
            {active && <Button variant="ghost" size="sm" onClick={() => setOverview({ from: undefined, to: undefined, region: 'ALL', category: 'ALL' })}><X /> Clear</Button>}
          </div>
        }
      />
      <QualityCard q={quality.data} loading={quality.isLoading} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Report types" className="rounded-card border border-line bg-white p-2">
          {REPORTS.map((x) => (
            <button
              key={x.type}
              onClick={() => setType(x.type)}
              aria-current={type === x.type ? 'true' : undefined}
              className={cn('block w-full rounded-md px-3 py-2 text-left text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue', type === x.type ? 'bg-navy text-white' : 'text-navy hover:bg-bg')}
            >
              {x.label}
            </button>
          ))}
        </nav>
        {error ? <ErrorState error={error} onRetry={() => refetch()} /> : (
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader
                title={r?.title ?? 'Loading…'}
                subtitle={r ? `${r.description}${filterText ? ` · ${filterText}` : ''}` : undefined}
                action={r && (
                  <ExportMenu
                    title={r.title}
                    subtitle={`${r.description}${filterText ? ` · Filters: ${filterText}` : ''}`}
                    fileName={`samanvay-${r.type}-report`}
                    columns={r.columns}
                    getRows={() => r.rows}
                  />
                )}
              />
              <CardBody className={cn(isFetching && 'opacity-60 transition-opacity')}>{isLoading || !r ? <Skeleton className="h-72" /> : <ReportChart r={r} />}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Table" subtitle={r ? `${r.rows.length} row(s)` : undefined} />
              {isLoading || !r ? <div className="p-4"><Skeleton className="h-40" /></div> : (
                <div className="scrollbar-thin max-h-[480px] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0">
                      <tr className="border-b border-line bg-[#F5F8FC] text-left text-[11.5px] uppercase tracking-wide text-muted">
                        {r.columns.map((c) => <th key={c.key} scope="col" className={cn('whitespace-nowrap px-3 py-2 font-semibold', c.numeric && 'text-right')}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {r.rows.map((row, i) => (
                        <tr key={i} className="border-b border-line/70 last:border-0">
                          {r.columns.map((c) => <td key={c.key} className={cn('px-3 py-1.5', c.numeric && 'text-right tabular-nums')}>{row[c.key]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
