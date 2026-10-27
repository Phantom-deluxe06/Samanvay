'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { useSla } from '@/api/hooks';
import type { SlaEscalation } from '@/api/types';
import { caseHref, fmtDateTime } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { BureauTag } from '@/components/common/badges';
import { DataTable } from '@/components/common/DataTable';
import { ExportMenu } from '@/components/common/ExportMenu';
import { ErrorState, KpiCard, LoadingCards, PageHeader } from '@/components/common/states';
import { caseColumns } from '@/components/cases/caseColumns';

const escColumns: ColumnDef<SlaEscalation, unknown>[] = [
  { id: 'caseId', header: 'Case', accessorKey: 'caseId', cell: ({ row }) => <Link href={caseHref(row.original.caseId)} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-blue hover:underline">{row.original.caseId}</Link> },
  { id: 'bureau', header: 'Bureau', accessorKey: 'bureau', cell: ({ row }) => <BureauTag bureau={row.original.bureau} /> },
  { id: 'category', header: 'Category', accessorKey: 'category' },
  {
    id: 'to', header: 'Escalated to', accessorKey: 'to',
    cell: ({ row }) => <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.original.to === 'Director' ? 'bg-brand-red text-white' : 'bg-[#FBE1DE] text-brand-red'}`}><TrendingUp className="h-3 w-3" aria-hidden />{row.original.to}</span>,
  },
  { id: 'at', header: 'When', accessorKey: 'at', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted">{fmtDateTime(row.original.at)}</span> },
  { id: 'by', header: 'By', accessorKey: 'by', cell: ({ row }) => <span className="whitespace-nowrap text-xs">{row.original.by}</span> },
  { id: 'overdue', header: 'Overdue now', accessorKey: 'overdueDays', cell: ({ row }) => <span className="font-semibold tabular-nums text-brand-red">{row.original.overdueDays ? `+${row.original.overdueDays} d` : '—'}</span> },
  { id: 'remarks', header: 'Remarks', accessorKey: 'remarks', enableSorting: false, cell: ({ row }) => <span className="line-clamp-2 max-w-[320px] text-xs text-muted">{row.original.remarks}</span> },
];

export default function SlaPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useSla();
  const [tab, setTab] = React.useState('escalations');

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <LoadingCards count={3} className="md:grid-cols-3" />;

  const autoCount = data.escalations.filter((e) => e.by.startsWith('System')).length;
  return (
    <>
      <PageHeader
        title="SLA & Escalations"
        subtitle="Every category has an SLA. When a case passes its expected disposal date the SLA monitor escalates it up the chain automatically."
        actions={
          <ExportMenu
            title="Escalation log"
            fileName="samanvay-escalations"
            columns={[{ key: 'caseId', label: 'Case' }, { key: 'bureau', label: 'Bureau' }, { key: 'category', label: 'Category' }, { key: 'to', label: 'Escalated to' }, { key: 'at', label: 'When' }, { key: 'by', label: 'By' }, { key: 'remarks', label: 'Remarks' }]}
            getRows={() => data.escalations.map((e) => ({ ...e, at: fmtDateTime(e.at) }))}
          />
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Due in 3 days" value={data.dueSoon.length} tone="amber" onClick={() => setTab('due')} active={tab === 'due'} />
        <KpiCard label="Overdue (beyond SLA)" value={data.overdue.length} tone="red" onClick={() => setTab('overdue')} active={tab === 'overdue'} />
        <KpiCard label="Escalations logged" value={data.escalations.length} tone="navy" onClick={() => setTab('escalations')} active={tab === 'escalations'} />
        <KpiCard label="Auto-escalated by SLA monitor" value={autoCount} tone="saffron" onClick={() => setTab('escalations')} />
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1fr_300px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="mb-3">
            <TabsTrigger value="due">Due in 3 days ({data.dueSoon.length})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({data.overdue.length})</TabsTrigger>
            <TabsTrigger value="escalations">Escalation log ({data.escalations.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="due">
            <DataTable columns={caseColumns} data={data.dueSoon} getRowId={(r) => r.caseId} onRowClick={(r) => router.push(caseHref(r.caseId))} emptyTitle="Nothing due in the next 3 days" initialSorting={[{ id: 'sla', desc: false }]} />
          </TabsContent>
          <TabsContent value="overdue">
            <DataTable columns={caseColumns} data={data.overdue} getRowId={(r) => r.caseId} onRowClick={(r) => router.push(caseHref(r.caseId))} emptyTitle="No overdue cases" initialSorting={[{ id: 'sla', desc: false }]} />
          </TabsContent>
          <TabsContent value="escalations">
            <div data-tour="escalation-log">
              <DataTable columns={escColumns} data={data.escalations} getRowId={(r) => `${r.caseId}-${r.at}-${r.to}`} onRowClick={(r) => router.push(caseHref(r.caseId))} emptyTitle="No escalations yet" emptyBody="Use Demo → Time travel to move the clock forward and watch breaches escalate." initialSorting={[{ id: 'at', desc: true }]} />
            </div>
          </TabsContent>
        </Tabs>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1 2xl:content-start">
          <Card>
            <CardHeader title="Escalation chain" subtitle={`Next level every ${data.stepDays} days overdue`} />
            <CardBody>
              <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                {data.chain.map((lvl, i) => (
                  <React.Fragment key={lvl}>
                    <li className={`rounded-full px-2.5 py-1 ${i === 0 ? 'bg-[#E3ECFA] text-navy-2' : i === 1 ? 'bg-[#FBE1DE] text-brand-red' : 'bg-brand-red text-white'}`}>{lvl}</li>
                    {i < data.chain.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />}
                  </React.Fragment>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-muted">Day 1 overdue → {data.chain[1]}; {data.stepDays + 1}+ days overdue → {data.chain[2]}.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="SLA rules" subtitle="Days to dispose, per category" action={<Link href="/settings" className="text-xs font-semibold text-brand-blue hover:underline">Edit</Link>} />
            <ul className="divide-y divide-line text-[13px]">
              {Object.entries(data.rules).sort((a, b) => a[1] - b[1]).map(([cat, days]) => (
                <li key={cat} className="flex justify-between px-4 py-1.5"><span>{cat}</span><span className="font-semibold tabular-nums">{days} d</span></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
