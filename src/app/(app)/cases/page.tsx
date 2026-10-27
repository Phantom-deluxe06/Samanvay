'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { useCases, useClusters } from '@/api/hooks';
import type { CaseFilters, CaseView, StatusFilter } from '@/api/types';
import { BUREAUS, BUREAU_SHORT, CATEGORIES, REGIONS, STATUSES } from '@/lib/constants';
import type { BureauCode, Category, Region } from '@/lib/types';
import { caseHref } from '@/lib/utils';
import { useDemo } from '@/store/demo';
import { useRoleInfo } from '@/store/role';
import { Button, Input, Switch } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { DataTable } from '@/components/common/DataTable';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/states';
import { caseColumns, caseExportColumns, caseExportRows } from '@/components/cases/caseColumns';
import { OverlapBanner } from '@/components/overlaps/OverlapBanner';
import { CaseTabs } from '@/components/cases/CaseTabs';

const ALL = 'ALL';

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function CasesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ownBureau, seesAll, readOnly, session } = useRoleInfo();
  const openIntake = useDemo((s) => s.openIntake);

  const [q, setQ] = React.useState(params.get('q') ?? '');
  const [f, setF] = React.useState<CaseFilters>(() => ({
    status: (params.get('status') as StatusFilter) ?? ALL,
    bureau: (params.get('bureau') as BureauCode) ?? ALL,
    category: (params.get('category') as Category) ?? ALL,
    region: (params.get('region') as Region) ?? ALL,
    onlyOverlapping: params.get('overlapping') === '1',
    needsConfirmation: false,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  }));
  const dq = useDebounced(q);
  const filters = React.useMemo(() => ({ ...f, q: dq || undefined }), [f, dq]);
  const { data, isLoading, isFetching, error, refetch } = useCases(filters);
  const { data: clusters } = useClusters();
  const [selected, setSelected] = React.useState<CaseView[]>([]);

  // Most relevant alert first: clusters holding the signed-in officer's own cases, then highest institution risk, then newest.
  const mine = (c: { cases: CaseView[] }) => (c.cases.some((x) => x.officer === session?.officer) ? 1 : 0);
  const banner = clusters
    ?.filter((c) => c.level === 'L1-institution' && c.status === 'Open' && (!ownBureau || c.bureaus.includes(ownBureau)))
    .sort((a, b) => mine(b) - mine(a) || b.risk.score - a.risk.score || b.createdAt.localeCompare(a.createdAt));

  const set = (patch: Partial<CaseFilters>) => setF((x) => ({ ...x, ...patch }));
  const active = Object.entries(f).filter(([, v]) => v && v !== ALL).length + (q ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Case Register"
        subtitle={seesAll ? 'All bureaus and cells · national view' : `${ownBureau ? BUREAU_SHORT[ownBureau] : ''} cases plus every overlapping case that involves your bureau`}
        actions={
          <>
            <ExportMenu
              title="Case Register"
              subtitle={selected.length ? `${selected.length} selected case(s)` : `${data?.length ?? 0} case(s) matching the current filters`}
              fileName="samanvay-cases"
              label={selected.length ? `Export ${selected.length} selected` : 'Export'}
              columns={caseExportColumns}
              getRows={() => caseExportRows(selected.length ? selected : data ?? [])}
            />
            {!readOnly && <Button onClick={() => openIntake()} data-tour="new-complaint"><Plus /> New complaint</Button>}
          </>
        }
      />
      {!!banner?.length && (
        <div className="mb-4 space-y-2">
          <OverlapBanner cluster={banner[0]} readOnly={readOnly} />
          {banner.length > 1 && <Link href="/overlaps" className="block text-right text-xs font-semibold text-brand-blue hover:underline">+{banner.length - 1} more open overlap alert(s) →</Link>}
        </div>
      )}
      <CaseTabs active="all" />
      {error ? (
        <div className="rounded-card border border-line bg-white p-6 text-center text-sm">
          Could not load cases. <Button variant="link" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <DataTable
          columns={caseColumns}
          data={data}
          loading={isLoading || isFetching}
          getRowId={(r) => r.caseId}
          selectable
          onSelectionChange={setSelected}
          onRowClick={(r) => router.push(caseHref(r.caseId))}
          rowClassName={(r) => (r.inCluster ? 'shadow-[inset_3px_0_0_#F39C34]' : undefined)}
          emptyTitle="No cases match these filters"
          emptyBody="Try clearing a filter or searching by AICTE ID, alias or case ID."
          initialSorting={[{ id: 'received', desc: true }]}
          toolbar={
            <>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Institution, alias, AICTE ID, case ID" className="pl-8" aria-label="Search cases" />
              </div>
              {seesAll && (
                <div className="w-32"><Select ariaLabel="Bureau" value={f.bureau ?? ALL} onValueChange={(v) => set({ bureau: v as BureauCode })} options={[{ value: ALL, label: 'All bureaus' }, ...BUREAUS.map((b) => ({ value: b, label: BUREAU_SHORT[b] }))]} /></div>
              )}
              <div className="w-36"><Select ariaLabel="Region" value={f.region ?? ALL} onValueChange={(v) => set({ region: v as Region })} options={[{ value: ALL, label: 'All regions' }, ...REGIONS.map((r) => ({ value: r, label: r }))]} /></div>
              <div className="w-44"><Select ariaLabel="Category" value={f.category ?? ALL} onValueChange={(v) => set({ category: v as Category })} options={[{ value: ALL, label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} /></div>
              <div className="w-36">
                <Select ariaLabel="Status" value={f.status ?? ALL} onValueChange={(v) => set({ status: v as StatusFilter })} options={[{ value: ALL, label: 'All statuses' }, { value: 'Open', label: 'Open (pending)' }, { value: 'Overdue', label: 'Overdue' }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
              </div>
              <Input type="date" aria-label="Received from" value={f.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} className="w-[140px]" />
              <Input type="date" aria-label="Received to" value={f.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} className="w-[140px]" />
              <label className="flex items-center gap-1.5 text-xs font-medium text-navy">
                <Switch checked={!!f.onlyOverlapping} onCheckedChange={(v) => set({ onlyOverlapping: v })} aria-label="Only overlapping" /> Only overlapping
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-navy">
                <Switch checked={!!f.needsConfirmation} onCheckedChange={(v) => set({ needsConfirmation: v })} aria-label="Needs confirmation" /> Needs confirmation
              </label>
              {active > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setQ(''); setF({ status: ALL, bureau: ALL, category: ALL, region: ALL }); }}>
                  <X /> Clear
                </Button>
              )}
            </>
          }
        />
      )}
    </>
  );
}

export default function CasesPage() {
  return (
    <React.Suspense fallback={null}>
      <CasesInner />
    </React.Suspense>
  );
}
