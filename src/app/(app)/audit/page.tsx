'use client';
import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Loader2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAudit, useVerifyAudit } from '@/api/hooks';
import type { AuditEvent } from '@/lib/types';
import { caseHref, cn, fmtDateTime } from '@/lib/utils';
import { exportCsv } from '@/lib/export';
import { useRoleInfo } from '@/store/role';
import { Button, Input, Tooltip } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { DataTable } from '@/components/common/DataTable';
import { ErrorState, PageHeader } from '@/components/common/states';

function Target({ t }: { t: string }) {
  if (/^(PG|RB|RO|OC)\/\d{4}\/\d+$/.test(t)) return <Link href={caseHref(t)} className="font-semibold text-brand-blue hover:underline" onClick={(e) => e.stopPropagation()}>{t}</Link>;
  if (/^CL-\d+$/.test(t)) return <Link href={`/overlaps/${t}`} className="font-semibold text-brand-blue hover:underline" onClick={(e) => e.stopPropagation()}>{t}</Link>;
  if (/^1-[0-9X]{10}$/.test(t)) return <Link href={`/institutions/${encodeURIComponent(t)}`} className="font-semibold text-brand-blue hover:underline" onClick={(e) => e.stopPropagation()}>{t}</Link>;
  return <span className="font-medium">{t}</span>;
}

const columns: ColumnDef<AuditEvent, unknown>[] = [
  { id: 'id', header: 'Record', accessorKey: 'id', cell: ({ row }) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{row.original.id}</span> },
  { id: 'at', header: 'Time', accessorKey: 'at', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{fmtDateTime(row.original.at)}</span> },
  {
    id: 'actor', header: 'Actor', accessorKey: 'actor',
    cell: ({ row }) => <div className="whitespace-nowrap"><div className="font-medium">{row.original.actor}</div><div className="text-[11px] text-muted">{row.original.role}</div></div>,
  },
  { id: 'action', header: 'Action', accessorKey: 'action', cell: ({ row }) => <span className={cn('whitespace-nowrap font-semibold', row.original.actor.startsWith('System') && 'text-[#A35A0A]')}>{row.original.action}</span> },
  { id: 'target', header: 'Target', accessorKey: 'target', cell: ({ row }) => <Target t={row.original.target} /> },
  { id: 'detail', header: 'Detail', accessorKey: 'detail', enableSorting: false, cell: ({ row }) => <span className="line-clamp-2 max-w-[340px] text-xs text-muted" title={row.original.detail}>{row.original.detail}</span> },
  {
    id: 'hash', header: 'Hash', accessorKey: 'hash', enableSorting: false,
    cell: ({ row }) => (
      <Tooltip content={<div className="font-mono text-[10px]"><div>hash {row.original.hash}</div><div>prev {row.original.prevHash}</div></div>}>
        <span tabIndex={0} className="cursor-help font-mono text-[11px] text-muted">{row.original.hash.slice(0, 10)}…</span>
      </Tooltip>
    ),
  },
];

export default function AuditPage() {
  const { isAdmin, seesAll } = useRoleInfo();
  const [q, setQ] = React.useState('');
  const [dq, setDq] = React.useState('');
  const [action, setAction] = React.useState('ALL');
  React.useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, isFetching, error, refetch } = useAudit({ q: dq || undefined, action: action === 'ALL' ? undefined : action });
  const all = useAudit({});
  const verify = useVerifyAudit();
  const actions = React.useMemo(() => [...new Set((all.data ?? []).map((e) => e.action))].sort(), [all.data]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  const res = verify.data;

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle={`Append-only and hash-chained: each record stores sha256(previous hash + record). ${seesAll ? 'Showing every record.' : 'Showing your actions and events on cases and clusters you can see.'}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportCsv({ fileName: 'samanvay-audit', columns: [{ key: 'id', label: 'Record' }, { key: 'at', label: 'Time' }, { key: 'actor', label: 'Actor' }, { key: 'role', label: 'Role' }, { key: 'action', label: 'Action' }, { key: 'target', label: 'Target' }, { key: 'detail', label: 'Detail' }, { key: 'prevHash', label: 'Prev hash' }, { key: 'hash', label: 'Hash' }], rows: (data ?? []).map((e) => ({ ...e })) })} disabled={!data?.length}>
              Export CSV
            </Button>
            <Button variant="navy" size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify chain
            </Button>
          </>
        }
      />
      {res && (
        <div role="status" className={cn('mb-4 flex items-start gap-3 rounded-card border p-3', res.ok ? 'border-[#A9DCB9] bg-[#DFF3E6]' : 'border-[#F2B8B0] bg-[#FBE1DE]')}>
          {res.ok ? <CheckCircle2 className="h-5 w-5 text-brand-green" /> : <ShieldAlert className="h-5 w-5 text-brand-red" />}
          <div className="text-[13px]">
            {res.ok ? (
              <><strong className="text-brand-green">Chain intact ✓</strong> — all {res.checked} records recomputed and verified{isAdmin ? '' : ' (full chain, including records outside your view)'}.</>
            ) : (
              <><strong className="text-brand-red">Chain broken</strong> at record <span className="font-mono">{res.brokenAt?.id}</span> (#{(res.brokenAt?.index ?? 0) + 1}): {res.brokenAt?.reason}.</>
            )}
          </div>
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading || isFetching}
        getRowId={(r) => r.id}
        emptyTitle="No audit records match"
        initialSorting={[{ id: 'at', desc: true }]}
        pageSize={25}
        dense
        toolbar={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, action, case or cluster ID, detail" className="pl-8" aria-label="Search audit log" />
            </div>
            <div className="w-56"><Select ariaLabel="Action" value={action} onValueChange={setAction} options={[{ value: 'ALL', label: 'All actions' }, ...actions.map((a) => ({ value: a, label: a }))]} /></div>
          </>
        }
      />
    </>
  );
}
