'use client';
import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { exportCsv, exportExcel, exportPdf, type ExportColumn, type ExportRow } from '@/lib/export';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/primitives';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';

export function ExportMenu({ title, subtitle, fileName, columns, getRows, label = 'Export', csv }: { title: string; subtitle?: string; fileName: string; columns: ExportColumn[]; getRows: () => ExportRow[]; label?: string; csv?: boolean }) {
  const officer = useSession((s) => s.session?.officer);
  const [busy, setBusy] = React.useState(false);
  const run = async (kind: 'pdf' | 'xlsx' | 'csv') => {
    const rows = getRows();
    if (!rows.length) {
      toast({ tone: 'info', title: 'Nothing to export' });
      return;
    }
    setBusy(true);
    try {
      if (kind === 'pdf') await exportPdf({ title, subtitle, columns, rows, fileName, generatedBy: officer });
      else if (kind === 'xlsx') await exportExcel({ sheetName: title, columns, rows, fileName, title });
      else exportCsv({ columns, rows, fileName });
      toast({ tone: 'success', title: `Exported ${rows.length} row(s)`, description: `${kind.toUpperCase()} downloaded.` });
    } catch (e) {
      toast({ tone: 'error', title: 'Export failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Download />} {label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => run('pdf')}><FileText /> PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('xlsx')}><FileSpreadsheet /> Excel (.xlsx)</DropdownMenuItem>
        {csv && <DropdownMenuItem onSelect={() => run('csv')}><Download /> CSV</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
