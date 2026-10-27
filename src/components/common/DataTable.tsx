'use client';
import * as React from 'react';
import {
  flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox } from '@/components/ui/primitives';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, Select } from '@/components/ui/overlays';
import { EmptyState, LoadingRows } from './states';

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  loading?: boolean;
  getRowId: (row: T) => string;
  selectable?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyBody?: React.ReactNode;
  pageSize?: number;
  initialSorting?: SortingState;
  initialHidden?: VisibilityState;
  dense?: boolean;
}

export function DataTable<T>({
  columns, data, loading, getRowId, selectable, onSelectionChange, onRowClick, rowClassName, toolbar, emptyTitle = 'Nothing here', emptyBody,
  pageSize = 15, initialSorting = [], initialHidden = {}, dense,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [visibility, setVisibility] = React.useState<VisibilityState>(initialHidden);

  const cols = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id: '_select',
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} onClick={(e) => e.stopPropagation()} />,
      },
      ...columns,
    ];
  }, [columns, selectable]);

  const table = useReactTable({
    data: data ?? [],
    columns: cols,
    state: { sorting, rowSelection, columnVisibility: visibility },
    getRowId,
    enableRowSelection: !!selectable,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });

  React.useEffect(() => {
    onSelectionChange?.(table.getSelectedRowModel().flatRows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, data]);

  const total = data?.length ?? 0;
  const { pageIndex, pageSize: ps } = table.getState().pagination;

  return (
    <div className="rounded-card border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Choose columns"><Columns3 /> Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {loading && !data ? (
        <LoadingRows />
      ) : !total ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-line bg-[#F5F8FC]">
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted();
                    return (
                      <th key={h.id} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted" aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}>
                        {h.isPlaceholder ? null : h.column.getCanSort() ? (
                          <button className="inline-flex items-center gap-1 rounded hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sorted === 'asc' ? <ArrowUp className="h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className={cn(loading && 'opacity-60 transition-opacity')}>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn('border-b border-line/70 last:border-0', onRowClick && 'cursor-pointer hover:bg-[#F5F9FF]', row.getIsSelected() && 'bg-[#EEF5FF]', rowClassName?.(row.original))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn('px-3 align-middle', dense ? 'py-1.5' : 'py-2.5')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          <span>
            {selectable && table.getSelectedRowModel().flatRows.length > 0 && <strong className="mr-2 text-navy">{table.getSelectedRowModel().flatRows.length} selected ·</strong>}
            {pageIndex * ps + 1}–{Math.min(total, (pageIndex + 1) * ps)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <div className="w-20"><Select ariaLabel="Rows per page" value={String(ps)} onValueChange={(v) => table.setPageSize(Number(v))} options={[10, 15, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))} className="h-8 text-xs" /></div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="tabular-nums">{pageIndex + 1} / {table.getPageCount()}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
