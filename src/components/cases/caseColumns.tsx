'use client';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import type { CaseView } from '@/api/types';
import { BUREAU_SHORT } from '@/lib/constants';
import { caseHref, fmtDate } from '@/lib/utils';
import type { ExportColumn, ExportRow } from '@/lib/export';
import { slaText } from '@/lib/utils';
import { BureauTag, LinkedTo, SlaBadge, StatusPill } from '@/components/common/badges';

export const caseColumns: ColumnDef<CaseView, unknown>[] = [
  {
    id: 'caseId', header: 'Case ID', accessorKey: 'caseId',
    cell: ({ row }) => (
      <Link href={caseHref(row.original.caseId)} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-semibold text-brand-blue hover:underline">
        {row.original.caseId}
      </Link>
    ),
  },
  { id: 'received', header: 'Received', accessorKey: 'receivedAt', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted">{fmtDate(row.original.receivedAt)}</span> },
  {
    id: 'institution', header: 'Institution (as written)', accessorKey: 'rawInstitutionText',
    cell: ({ row }) => (
      <div className="max-w-[260px]">
        <div className="truncate font-medium text-navy" title={row.original.rawInstitutionText}>“{row.original.rawInstitutionText}”</div>
        {row.original.institution && <div className="truncate text-[11px] text-muted">{row.original.institution.name}</div>}
      </div>
    ),
  },
  {
    id: 'linked', header: 'Linked to', accessorFn: (r) => r.match.confidence,
    cell: ({ row }) => <LinkedTo aicteId={row.original.match.aicteId} confidence={row.original.match.confidence} inCluster={row.original.inCluster} method={row.original.match.method} />,
  },
  { id: 'category', header: 'Category', accessorKey: 'category', cell: ({ row }) => <span className="whitespace-nowrap">{row.original.category}</span> },
  { id: 'bureau', header: 'Bureau', accessorKey: 'bureau', cell: ({ row }) => <BureauTag bureau={row.original.bureau} /> },
  { id: 'officer', header: 'Officer', accessorKey: 'officer', cell: ({ row }) => <span className="whitespace-nowrap">{row.original.officer}</span> },
  { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusPill status={row.original.status} overdue={row.original.overdue} /> },
  {
    id: 'sla', header: 'SLA', accessorFn: (r) => (r.status === 'Disposed' ? 9999 : r.daysLeft),
    cell: ({ row }) => <SlaBadge daysLeft={row.original.daysLeft} disposed={row.original.status === 'Disposed'} />,
  },
];

export const caseExportColumns: ExportColumn[] = [
  { key: 'caseId', label: 'Case ID' },
  { key: 'received', label: 'Received' },
  { key: 'raw', label: 'Institution (as written)' },
  { key: 'linked', label: 'Linked to' },
  { key: 'category', label: 'Category' },
  { key: 'bureau', label: 'Bureau' },
  { key: 'officer', label: 'Officer' },
  { key: 'status', label: 'Status' },
  { key: 'sla', label: 'SLA' },
];

export function caseExportRows(rows: CaseView[]): ExportRow[] {
  return rows.map((c) => ({
    caseId: c.caseId,
    received: fmtDate(c.receivedAt),
    raw: c.rawInstitutionText,
    linked: c.match.aicteId ? `${c.match.aicteId} · ${c.match.method === 'manual' ? 'confirmed' : `${c.match.confidence}%`}${c.inCluster ? ' · cluster' : ''}` : `Needs confirmation (${c.match.confidence}%)`,
    category: c.category,
    bureau: BUREAU_SHORT[c.bureau],
    officer: c.officer,
    status: c.overdue ? 'Overdue' : c.status,
    sla: slaText(c.daysLeft, c.status === 'Disposed'),
  }));
}
