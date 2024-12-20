import React, { useCallback, useEffect, useRef, useState } from 'react'; // ^18.0.0
import * as RadixTable from '@radix-ui/react-table'; // ^1.0.3
import cn from 'classnames'; // ^2.3.2
import Loading from './Loading';
import { PaginatedResponse, SortOrder } from '../../types/common';
import { COLORS, SPACING, TRANSITIONS } from '../../constants/ui';

// Column definition interface with enhanced customization options
export interface ColumnDefinition<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  ariaLabel?: string;
  resizable?: boolean;
  hidden?: boolean;
  onResize?: (width: number) => void;
}

// Props interface with comprehensive feature support
export interface TableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  sortable?: boolean;
  sortOrder?: SortOrder;
  onSort?: (order: SortOrder) => void;
  paginated?: boolean;
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  virtualScroll?: boolean;
  rowHeight?: number;
  ariaLabel?: string;
  ariaDescription?: string;
}

export const Table = <T extends Record<string, unknown>>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data available',
  sortable = false,
  sortOrder,
  onSort,
  paginated = false,
  currentPage = 1,
  pageSize = 20,
  totalItems = 0,
  onPageChange,
  className,
  virtualScroll = false,
  rowHeight = 48,
  ariaLabel = 'Data table',
  ariaDescription,
}: TableProps<T>): JSX.Element => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Handle column sorting with keyboard support
  const handleSort = useCallback((columnKey: string, event?: React.KeyboardEvent) => {
    if (!sortable || !onSort) return;

    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    if (event && !['Enter', ' '].includes(event.key)) return;

    const newDirection = sortOrder?.field === columnKey && sortOrder.direction === 'asc' ? 'desc' : 'asc';
    onSort({ field: columnKey, direction: newDirection });

    // Announce sort change to screen readers
    const announcement = `Table sorted by ${column.header} in ${newDirection}ending order`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  }, [sortable, onSort, columns, sortOrder]);

  // Set up virtual scrolling if enabled
  useEffect(() => {
    if (!virtualScroll || !tableRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const tableEntry = entries[0];
        if (!tableEntry.isIntersecting) return;

        const tableHeight = tableEntry.boundingClientRect.height;
        const visibleRows = Math.ceil(tableHeight / rowHeight);
        const buffer = Math.floor(visibleRows / 2);

        setVisibleRange({
          start: Math.max(0, currentPage * pageSize - buffer),
          end: Math.min(data.length, currentPage * pageSize + visibleRows + buffer)
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [virtualScroll, currentPage, pageSize, data.length, rowHeight]);

  // Base table styles
  const tableStyles = cn(
    'w-full border-collapse',
    'bg-white dark:bg-gray-800',
    'border border-gray-200 dark:border-gray-700',
    'rounded-lg overflow-hidden',
    className
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loading size="md" text="Loading table data..." />
      </div>
    );
  }

  // Empty state
  if (!data.length) {
    return (
      <div className="flex justify-center items-center p-8 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div 
      ref={tableRef}
      className="relative"
      role="region"
      aria-label={ariaLabel}
      aria-description={ariaDescription}
    >
      <RadixTable.Root className={tableStyles}>
        <RadixTable.Header className="bg-gray-50 dark:bg-gray-900">
          <RadixTable.Row>
            {columns.map(column => !column.hidden && (
              <RadixTable.ColumnHeaderCell
                key={column.key}
                className={cn(
                  'px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100',
                  'border-b border-gray-200 dark:border-gray-700',
                  {
                    'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800': column.sortable && sortable,
                    [`text-${column.align || 'left'}`]: true,
                  }
                )}
                style={{ width: column.width }}
                onClick={() => handleSort(column.key)}
                onKeyDown={(e) => handleSort(column.key, e)}
                tabIndex={column.sortable ? 0 : -1}
                aria-sort={
                  sortOrder?.field === column.key
                    ? sortOrder.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && sortable && sortOrder?.field === column.key && (
                    <span className="text-primary-600 dark:text-primary-400">
                      {sortOrder.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </RadixTable.ColumnHeaderCell>
            ))}
          </RadixTable.Row>
        </RadixTable.Header>

        <RadixTable.Body>
          {(virtualScroll ? data.slice(visibleRange.start, visibleRange.end) : data).map((item, index) => (
            <RadixTable.Row
              key={index}
              className={cn(
                'transition-colors',
                'hover:bg-gray-50 dark:hover:bg-gray-800',
                'focus-within:bg-gray-100 dark:focus-within:bg-gray-700'
              )}
            >
              {columns.map(column => !column.hidden && (
                <RadixTable.Cell
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-sm text-gray-700 dark:text-gray-300',
                    'border-b border-gray-200 dark:border-gray-700',
                    [`text-${column.align || 'left'}`]: true
                  )}
                >
                  {column.render(item)}
                </RadixTable.Cell>
              ))}
            </RadixTable.Row>
          ))}
        </RadixTable.Body>
      </RadixTable.Root>

      {paginated && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} results
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              className={cn(
                'px-3 py-1 text-sm rounded-md',
                'border border-gray-300 dark:border-gray-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage * pageSize >= totalItems}
              className={cn(
                'px-3 py-1 text-sm rounded-md',
                'border border-gray-300 dark:border-gray-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;