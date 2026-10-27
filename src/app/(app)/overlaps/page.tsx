'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useClusters } from '@/api/hooks';
import type { ClusterView } from '@/api/types';
import { BUREAU_SHORT } from '@/lib/constants';
import { fmtDate } from '@/lib/utils';
import { Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { BureauTag, ClusterStatusPill, LevelBadge, RiskBadge } from '@/components/common/badges';
import { DataTable } from '@/components/common/DataTable';
import { ExportMenu } from '@/components/common/ExportMenu';
import { ErrorState, KpiCard, PageHeader } from '@/components/common/states';

const columns: ColumnDef<ClusterView, unknown>[] = [
  { id: 'clusterId', header: 'Cluster', accessorKey: 'clusterId', cell: ({ row }) => <Link href={`/overlaps/${row.original.clusterId}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-blue hover:underline">{row.original.clusterId}</Link> },
  { id: 'level', header: 'Level', accessorKey: 'level', cell: ({ row }) => <LevelBadge level={row.original.level} /> },
  {
    id: 'institution', header: 'Institution', accessorFn: (r) => r.institution.name,
    cell: ({ row }) => <div className="max-w-[280px]"><div className="truncate font-medium">{row.original.institution.name}</div><div className="text-[11px] text-muted">{row.original.aicteId} · {row.original.institution.city}</div></div>,
  },
  { id: 'cases', header: 'Cases', accessorFn: (r) => r.caseIds.length, cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.caseIds.length}</span> },
  { id: 'bureaus', header: 'Bureaus', enableSorting: false, cell: ({ row }) => <div className="flex flex-wrap gap-1">{row.original.bureaus.map((b) => <BureauTag key={b} bureau={b} />)}</div> },
  { id: 'lead', header: 'Suggested lead', accessorKey: 'suggestedLead', cell: ({ row }) => <span className="whitespace-nowrap text-xs font-medium">{BUREAU_SHORT[row.original.suggestedLead]}{row.original.leadAccepted ? ' ✓' : ''}</span> },
  { id: 'similarity', header: 'Same issue?', accessorFn: (r) => r.similarity ?? 0, cell: ({ row }) => (row.original.similarity ? <span className="font-semibold tabular-nums text-[#A35A0A]">{row.original.similarity.toFixed(2)}</span> : <span className="text-muted">—</span>) },
  { id: 'risk', header: 'Risk', accessorFn: (r) => r.risk.score, cell: ({ row }) => <RiskBadge risk={row.original.risk} /> },
  { id: 'age', header: 'Age', accessorKey: 'ageDays', cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted" title={fmtDate(row.original.createdAt)}>{row.original.ageDays} d</span> },
  { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <ClusterStatusPill status={row.original.status} /> },
];

export default function OverlapsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useClusters();
  const [q, setQ] = React.useState('');
  const [level, setLevel] = React.useState('ALL');
  const [status, setStatus] = React.useState('LIVE');

  const rows = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (level !== 'ALL' && c.level !== level) return false;
      if (status === 'LIVE' && !(c.status === 'Open' || c.status === 'Coordinating')) return false;
      if (status !== 'LIVE' && status !== 'ALL' && c.status !== status) return false;
      if (qq && ![c.clusterId, c.aicteId, c.institution.name, ...c.caseIds].join(' ').toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [data, q, level, status]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  const count = (fn: (c: ClusterView) => boolean) => (data ?? []).filter(fn).length;

  return (
    <>
      <PageHeader
        title="Overlap Alerts"
        subtitle="Clusters raised by the overlap engine. L1 = same institution open in more than one bureau; L2 = same issue raised twice in different words."
        actions={
          <ExportMenu
            title="Overlap alerts"
            fileName="samanvay-overlaps"
            columns={[{ key: 'id', label: 'Cluster' }, { key: 'level', label: 'Level' }, { key: 'inst', label: 'Institution' }, { key: 'aicte', label: 'AICTE ID' }, { key: 'cases', label: 'Cases' }, { key: 'bureaus', label: 'Bureaus' }, { key: 'lead', label: 'Lead' }, { key: 'status', label: 'Status' }]}
            getRows={() => rows.map((c) => ({ id: c.clusterId, level: c.level, inst: c.institution.name, aicte: c.aicteId, cases: c.caseIds.join(' '), bureaus: c.bureaus.map((b) => BUREAU_SHORT[b]).join(', '), lead: BUREAU_SHORT[c.suggestedLead], status: c.status }))}
          />
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Open alerts" value={isLoading ? '…' : count((c) => c.status === 'Open')} tone="saffron" onClick={() => setStatus('Open')} active={status === 'Open'} />
        <KpiCard label="Coordinating" value={isLoading ? '…' : count((c) => c.status === 'Coordinating')} tone="blue" onClick={() => setStatus('Coordinating')} active={status === 'Coordinating'} />
        <KpiCard label="Resolved" value={isLoading ? '…' : count((c) => c.status === 'Resolved')} tone="green" onClick={() => setStatus('Resolved')} active={status === 'Resolved'} />
        <KpiCard label="Dismissed (not related)" value={isLoading ? '…' : count((c) => c.status === 'Dismissed')} tone="navy" onClick={() => setStatus('Dismissed')} active={status === 'Dismissed'} />
      </div>
      <DataTable
        columns={columns}
        data={isLoading ? undefined : rows}
        loading={isLoading}
        getRowId={(r) => r.clusterId}
        onRowClick={(r) => router.push(`/overlaps/${r.clusterId}`)}
        emptyTitle="No overlap alerts here"
        emptyBody="Nothing matches these filters. New alerts appear the moment a complaint links to an institution that already has open cases elsewhere."
        initialSorting={[{ id: 'age', desc: false }]}
        toolbar={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Institution, AICTE ID, case ID" className="pl-8" aria-label="Search clusters" />
            </div>
            <div className="w-40"><Select ariaLabel="Level" value={level} onValueChange={setLevel} options={[{ value: 'ALL', label: 'L1 + L2' }, { value: 'L1-institution', label: 'L1 · institution' }, { value: 'L2-same-issue', label: 'L2 · same issue' }]} /></div>
            <div className="w-44"><Select ariaLabel="Status" value={status} onValueChange={setStatus} options={[{ value: 'LIVE', label: 'Open + coordinating' }, { value: 'ALL', label: 'All statuses' }, { value: 'Open', label: 'Open' }, { value: 'Coordinating', label: 'Coordinating' }, { value: 'Resolved', label: 'Resolved' }, { value: 'Dismissed', label: 'Dismissed' }]} /></div>
          </>
        }
      />
    </>
  );
}
