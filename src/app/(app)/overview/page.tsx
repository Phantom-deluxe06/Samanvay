'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useOverview } from '@/api/hooks';
import type { Overview } from '@/api/types';
import { BUREAU_SHORT, CATEGORIES, REGIONS } from '@/lib/constants';
import type { Category, Region } from '@/lib/types';
import { instHref } from '@/lib/utils';
import { useFilters } from '@/store/filters';
import { useRoleInfo } from '@/store/role';
import { Button, Card, CardBody, CardHeader, Input, Skeleton } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { BureauTag, riskColor } from '@/components/common/badges';
import { ErrorState, KpiCard, PageHeader } from '@/components/common/states';
import { ColumnChart, HBarChart, LineTrendChart } from '@/components/charts/Charts';

/** Sequential single-hue ramp (light → dark) for the region tiles. */
const RAMP = ['#CDE2FB', '#9EC5F4', '#6DA7EC', '#3987E5', '#256ABF', '#184F95', '#0D366B'];
/** Rough geographic placement of AICTE regions on a 3×3 grid. */
const TILE_POS: Record<Region, string> = {
  'North-Western': 'col-start-1 row-start-1', Northern: 'col-start-2 row-start-1', 'North-Eastern': 'col-start-3 row-start-1',
  Western: 'col-start-1 row-start-2', Central: 'col-start-2 row-start-2', Eastern: 'col-start-3 row-start-2',
  'South-Western': 'col-start-1 row-start-3', Southern: 'col-start-2 row-start-3',
};

function RegionTiles({ regions, onPick }: { regions: Overview['regions']; onPick: (r: Region) => void }) {
  const max = Math.max(1, ...regions.map((r) => r.open));
  return (
    <div>
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5" role="list" aria-label="Open cases by region">
        {regions.map((r) => {
          const idx = Math.min(RAMP.length - 1, Math.round((r.open / max) * (RAMP.length - 1)));
          const dark = idx >= 3;
          return (
            <button
              key={r.region}
              role="listitem"
              onClick={() => onPick(r.region)}
              className={`${TILE_POS[r.region]} flex min-h-[64px] flex-col justify-between rounded-md p-2 text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-saffron`}
              style={{ background: RAMP[idx], color: dark ? '#FFFFFF' : '#0F2A52' }}
              aria-label={`${r.region}: ${r.open} open of ${r.total} cases`}
            >
              <span className="text-[11px] font-semibold leading-tight">{r.region}</span>
              <span className="text-lg font-bold leading-none">{r.open}<span className="ml-1 text-[10px] font-medium opacity-80">open</span></span>
            </button>
          );
        })}
        <div className="col-start-3 row-start-3 flex flex-col justify-end p-1 text-[10px] text-muted">
          <div className="mb-1 flex h-2 overflow-hidden rounded">{RAMP.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
          <div className="flex justify-between"><span>0</span><span>{max} open</span></div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const { overview: f, setOverview } = useFilters();
  const { seesAll } = useRoleInfo();
  const { data, isLoading, isFetching, error, refetch } = useOverview(f);
  const go = (q: string) => router.push(`/cases${q}`);
  const active = !!(f.from || f.to || (f.region && f.region !== 'ALL') || (f.category && f.category !== 'ALL'));

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  const k = data?.kpis;

  return (
    <>
      <PageHeader
        title={seesAll ? 'National Overview' : 'Overview'}
        subtitle={data ? `${data.scope}${isFetching ? ' · updating…' : ''}` : 'Loading…'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" aria-label="From date" value={f.from ?? ''} onChange={(e) => setOverview({ from: e.target.value || undefined })} className="w-[140px]" />
            <Input type="date" aria-label="To date" value={f.to ?? ''} onChange={(e) => setOverview({ to: e.target.value || undefined })} className="w-[140px]" />
            <div className="w-36"><Select ariaLabel="Region" value={f.region ?? 'ALL'} onValueChange={(v) => setOverview({ region: v as Region })} options={[{ value: 'ALL', label: 'All regions' }, ...REGIONS.map((r) => ({ value: r, label: r }))]} /></div>
            <div className="w-44"><Select ariaLabel="Category" value={f.category ?? 'ALL'} onValueChange={(v) => setOverview({ category: v as Category })} options={[{ value: 'ALL', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} /></div>
            {active && <Button variant="ghost" size="sm" onClick={() => setOverview({ from: undefined, to: undefined, region: 'ALL', category: 'ALL' })}><X /> Clear</Button>}
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total cases" value={k ? k.total.toLocaleString('en-IN') : '…'} hint="Open register →" onClick={() => go('')} />
        <KpiCard label="Pending" value={k ? k.pending.toLocaleString('en-IN') : '…'} tone="amber" hint="Not yet disposed →" onClick={() => go('?status=Open')} />
        <KpiCard label="Under process" value={k ? k.underProcess.toLocaleString('en-IN') : '…'} tone="blue" hint="Incl. inquiries →" onClick={() => go('?status=Under%20process')} />
        <KpiCard label="Disposed" value={k ? k.disposed.toLocaleString('en-IN') : '…'} tone="green" hint="Closed with remarks →" onClick={() => go('?status=Disposed')} />
        <KpiCard label="Beyond SLA" value={k ? k.beyondSla.toLocaleString('en-IN') : '…'} tone="red" hint="Overdue, open →" onClick={() => go('?status=Overdue')} />
        <KpiCard label="Overlap clusters" value={k ? k.clusters : '…'} tone="saffron" hint="Open + coordinating →" onClick={() => router.push('/overlaps')} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Bureau / Cell workload" subtitle="Open cases per bureau" />
          <CardBody>
            {isLoading || !data ? <Skeleton className="h-56" /> : !data.workload.length ? <p className="text-xs text-muted">No open cases.</p> : (
              <HBarChart
                data={data.workload.map((w) => ({ ...w, label: BUREAU_SHORT[w.bureau] }))}
                labelKey="label"
                valueKey="open"
                valueLabel="Open cases"
                color="#1F4B8A"
                onClick={seesAll ? (row) => go(`?bureau=${row.bureau}&status=Open`) : undefined}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pending case ageing" subtitle="Days since receipt, open cases" />
          <CardBody>
            {isLoading || !data ? <Skeleton className="h-56" /> : (
              <ColumnChart data={data.ageing} xKey="bucket" series={[{ key: 'count', label: 'Pending cases', color: '#1E8449' }]} barColors={['#1E8449', '#D68910', '#E67E22', '#C0392B']} showValues height={230} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Open cases by region" subtitle="Region of the institution · click a tile to filter" />
          <CardBody>{isLoading || !data ? <Skeleton className="h-56" /> : <RegionTiles regions={data.regions} onPick={(r) => go(`?region=${encodeURIComponent(r)}&status=Open`)} />}</CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Institutions needing attention" subtitle="Top 10 by risk score" action={<Link href="/institutions" className="text-xs font-semibold text-brand-blue hover:underline">All institutions →</Link>} />
          {isLoading || !data ? <div className="p-4"><Skeleton className="h-64" /></div> : !data.attention.length ? <p className="p-4 text-xs text-muted">No institutions with open cases in this view.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-[#F5F8FC] text-left text-[11.5px] uppercase tracking-wide text-muted">
                    <th scope="col" className="px-3 py-2 font-semibold">Institution</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Region</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Open</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Bureaus</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attention.map((r) => (
                    <tr key={r.aicteId} className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-[#F5F9FF]" onClick={() => router.push(instHref(r.aicteId))}>
                      <td className="max-w-[260px] px-3 py-2"><Link href={instHref(r.aicteId)} className="block truncate font-semibold text-navy hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link><span className="text-[11px] text-muted">{r.aicteId} · {r.city}</span></td>
                      <td className="px-3 py-2 text-muted">{r.region}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.openCases}</td>
                      <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{r.bureaus.map((b) => <BureauTag key={b} bureau={b} />)}</div></td>
                      <td className="px-3 py-2 text-right"><span className="font-bold tabular-nums" style={{ color: riskColor(r.risk.score) }}>{r.risk.score}</span> <span className="text-[11px] text-muted">{r.risk.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Monthly trend" subtitle="Cases received vs disposed, last 9 months" />
          <CardBody>
            {isLoading || !data ? <Skeleton className="h-60" /> : (
              <LineTrendChart data={data.trend} xKey="month" series={[{ key: 'received', label: 'Received', color: '#1A6FC4' }, { key: 'disposed', label: 'Disposed', color: '#1E8449' }]} height={260} />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
