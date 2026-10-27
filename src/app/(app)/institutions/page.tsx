'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useInstitutions } from '@/api/hooks';
import type { InstitutionRow } from '@/api/types';
import { REGIONS } from '@/lib/constants';
import { instHref } from '@/lib/utils';
import { Input, Switch } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { BureauTag, RiskBadge, riskColor } from '@/components/common/badges';
import { DataTable } from '@/components/common/DataTable';
import { ExportMenu } from '@/components/common/ExportMenu';
import { ErrorState, PageHeader } from '@/components/common/states';
import { Sparkline } from '@/components/charts/Charts';

const columns: ColumnDef<InstitutionRow, unknown>[] = [
  {
    id: 'name', header: 'Institution', accessorKey: 'name',
    cell: ({ row }) => (
      <div className="max-w-[320px]">
        <Link href={instHref(row.original.aicteId)} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-brand-blue hover:underline">{row.original.name}</Link>
        <div className="truncate text-[11px] text-muted">{row.original.type}{row.original.aliases.length ? ` · aka ${row.original.aliases.slice(0, 2).join(', ')}` : ''}</div>
      </div>
    ),
  },
  { id: 'aicteId', header: 'AICTE ID', accessorKey: 'aicteId', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.aicteId}</span> },
  { id: 'city', header: 'City', accessorKey: 'city' },
  { id: 'region', header: 'Region', accessorKey: 'region', cell: ({ row }) => <span className="whitespace-nowrap">{row.original.region}</span> },
  { id: 'open', header: 'Open cases', accessorKey: 'openCases', cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.openCases}</span> },
  { id: 'total', header: 'Total cases', accessorKey: 'totalCases', cell: ({ row }) => <span className="tabular-nums">{row.original.totalCases}</span> },
  {
    id: 'risk', header: 'Risk', accessorFn: (r) => r.risk.score,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <RiskBadge risk={row.original.risk} />
        <Sparkline values={row.original.spark} color={riskColor(row.original.risk.score)} label={`Cases per month, last 9 months: ${row.original.spark.join(', ')}`} />
      </div>
    ),
  },
  { id: 'bureaus', header: 'Bureaus (open)', enableSorting: false, cell: ({ row }) => <div className="flex max-w-[220px] flex-wrap gap-1">{row.original.bureaus.map((b) => <BureauTag key={b} bureau={b} />)}</div> },
];

export default function InstitutionsPage() {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [dq, setDq] = React.useState('');
  const [region, setRegion] = React.useState('ALL');
  const [onlyOpen, setOnlyOpen] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, isFetching, error, refetch } = useInstitutions(dq || undefined);
  const rows = React.useMemo(() => (data ?? []).filter((r) => (region === 'ALL' || r.region === region) && (!onlyOpen || r.openCases > 0)), [data, region, onlyOpen]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <>
      <PageHeader
        title="Institutions"
        subtitle="AICTE-approved institutions (synthetic, fictional names) with their case load and risk score. Aliases include spellings learnt from confirmed matches."
        actions={
          <ExportMenu
            title="Institutions"
            fileName="samanvay-institutions"
            columns={[{ key: 'name', label: 'Institution' }, { key: 'id', label: 'AICTE ID' }, { key: 'city', label: 'City' }, { key: 'region', label: 'Region' }, { key: 'open', label: 'Open' }, { key: 'total', label: 'Total' }, { key: 'risk', label: 'Risk' }]}
            getRows={() => rows.map((r) => ({ name: r.name, id: r.aicteId, city: r.city, region: r.region, open: r.openCases, total: r.totalCases, risk: `${r.risk.score} (${r.risk.label})` }))}
          />
        }
      />
      <DataTable
        columns={columns}
        data={isLoading ? undefined : rows}
        loading={isLoading || isFetching}
        getRowId={(r) => r.aicteId}
        onRowClick={(r) => router.push(instHref(r.aicteId))}
        emptyTitle="No institutions found"
        emptyBody="Search by name, alias (e.g. SVIT), AICTE ID or city."
        initialSorting={[{ id: 'risk', desc: true }]}
        toolbar={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, alias, AICTE ID or city" className="pl-8" aria-label="Search institutions" />
            </div>
            <div className="w-40"><Select ariaLabel="Region" value={region} onValueChange={setRegion} options={[{ value: 'ALL', label: 'All regions' }, ...REGIONS.map((r) => ({ value: r, label: r }))]} /></div>
            <label className="flex items-center gap-1.5 text-xs font-medium"><Switch checked={onlyOpen} onCheckedChange={setOnlyOpen} aria-label="Only with open cases" /> Only with open cases</label>
          </>
        }
      />
    </>
  );
}
