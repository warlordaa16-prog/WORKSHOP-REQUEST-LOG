import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  widthClass?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  pageSize = 10,
  onRowClick,
  emptyTitle = 'No matching records',
  emptyDescription = 'Try adjusting your filters or search query.',
  emptyActionLabel,
  onEmptyAction,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [data.length]);

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return data;
    const getter = col.sortValue;
    return [...data].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-11 px-4 flex items-center gap-4 animate-pulse">
              <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3.5 flex-1 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#08172C]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.widthClass
                  )}
                >
                  {col.sortable && col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors',
                        col.align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      <span>{col.header}</span>
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#10B981]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-45" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80 text-sm">
            {pagedData.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'h-11 transition-colors',
                  onRowClick &&
                    'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5 text-slate-800 dark:text-slate-200',
                      col.align === 'right' && 'text-right tabular-nums',
                      col.widthClass
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#08172C]/70 text-xs text-slate-600 dark:text-slate-400">
        <span className="tabular-nums">
          Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedData.length)} of{' '}
          {sortedData.length}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1F3A] text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>
          <span className="px-2 tabular-nums font-medium text-slate-700 dark:text-slate-300">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1F3A] text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
