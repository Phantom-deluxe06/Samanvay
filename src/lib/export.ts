'use client';
import { format } from 'date-fns';

export interface ExportColumn { key: string; label: string }
export type ExportRow = Record<string, string | number | null | undefined>;

function stamp() {
  return format(new Date(), 'yyyyMMdd-HHmm');
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PDF with the Samanvay header and generated-on time. Libraries are loaded on demand. */
export async function exportPdf(opts: { title: string; subtitle?: string; columns: ExportColumn[]; rows: ExportRow[]; fileName?: string; generatedBy?: string }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const landscape = opts.columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const header = () => {
    doc.setFillColor(15, 42, 82);
    doc.rect(0, 0, W, 54, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('SAMAN', 32, 34);
    const w = doc.getTextWidth('SAMAN');
    doc.setTextColor(243, 156, 52);
    doc.text('VAY', 32 + w, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(201, 214, 234);
    doc.text('AICTE Complaint Monitoring · Prototype · synthetic data', W - 32, 24, { align: 'right' });
    doc.text(`Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')}${opts.generatedBy ? ` by ${opts.generatedBy}` : ''}`, W - 32, 38, { align: 'right' });
  };

  header();
  doc.setTextColor(15, 42, 82);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(opts.title, 32, 82);
  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(91, 107, 130);
    doc.text(opts.subtitle, 32, 98);
  }
  autoTable(doc, {
    startY: opts.subtitle ? 110 : 96,
    head: [opts.columns.map((c) => c.label)],
    body: opts.rows.map((r) => opts.columns.map((c) => (r[c.key] ?? '') as string | number)),
    styles: { fontSize: 8, cellPadding: 4, textColor: [15, 42, 82], lineColor: [214, 223, 235], lineWidth: 0.5 },
    headStyles: { fillColor: [31, 75, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    margin: { left: 32, right: 32, top: 70 },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) header();
      doc.setFontSize(8);
      doc.setTextColor(135, 150, 171);
      doc.text(`SIH 2026 PS 26264 · page ${d.pageNumber}`, W - 32, doc.internal.pageSize.getHeight() - 16, { align: 'right' });
    },
  });
  doc.save(`${opts.fileName ?? 'samanvay-report'}-${stamp()}.pdf`);
}

export async function exportExcel(opts: { sheetName: string; columns: ExportColumn[]; rows: ExportRow[]; fileName?: string; title?: string }) {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [];
  if (opts.title) aoa.push([`Samanvay · ${opts.title}`], [`Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')} · synthetic data`], []);
  aoa.push(opts.columns.map((c) => c.label));
  for (const r of opts.rows) aoa.push(opts.columns.map((c) => (r[c.key] ?? '') as string | number));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = opts.columns.map((c) => ({ wch: Math.min(48, Math.max(10, c.label.length + 2, ...opts.rows.slice(0, 200).map((r) => String(r[c.key] ?? '').length + 1))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${opts.fileName ?? 'samanvay'}-${stamp()}.xlsx`);
}

export function exportCsv(opts: { columns: ExportColumn[]; rows: ExportRow[]; fileName?: string }) {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [opts.columns.map((c) => esc(c.label)).join(','), ...opts.rows.map((r) => opts.columns.map((c) => esc(r[c.key])).join(','))];
  download(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${opts.fileName ?? 'samanvay'}-${stamp()}.csv`);
}
