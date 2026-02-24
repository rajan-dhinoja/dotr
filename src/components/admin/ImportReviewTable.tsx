/**
 * ImportReviewTable - Reusable component for reviewing and selecting items before bulk import
 *
 * This component provides a standardized review-and-select flow for all bulk import
 * operations in the admin panel. It includes:
 * - Row selection with checkboxes (select all, individual selection)
 * - Search/filtering capabilities
 * - Status badges (new, existing, conflict, warning)
 * - Live summary counts
 * - Responsive table layout
 *
 * Usage pattern for new bulk imports:
 * 1. Parse and validate the import file
 * 2. Map parsed items to ImportReviewBaseRow-compatible rows
 * 3. Show ImportReviewTable in a wizard step (e.g., step === 'review')
 * 4. Collect selected IDs and convert to indexes
 * 5. Pass selected indexes to the import hook/function
 * 6. Only process selected items during import
 *
 * See PagesImportModal and SectionImportModal for complete examples.
 */
import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type ImportRowStatus = 'new' | 'existing' | 'conflict' | 'warning';

export interface ImportReviewBaseRow {
  /**
   * Stable identifier for the row. For imported items that do not yet
   * have a database id, this can be a synthetic id like `page-0`.
   */
  id: string;
}

export interface ImportReviewColumn<TRow extends ImportReviewBaseRow> {
  /**
   * Unique key for the column (used as React key and for testing).
   */
  key: string;
  /**
   * Human‑readable header label.
   */
  header: string;
  /**
   * Optional fixed width for the column.
   */
  width?: string | number;
  /**
   * Renderer for the cell.
   */
  render: (row: TRow) => React.ReactNode;
}

export interface ImportReviewTableProps<TRow extends ImportReviewBaseRow> {
  /**
   * Parsed + validated items to review.
   */
  rows: TRow[];
  /**
   * Column configuration describing how to render each row.
   */
  columns: ImportReviewColumn<TRow>[];
  /**
   * Currently selected row ids.
   */
  selectedIds: string[];
  /**
   * Called when the selection changes.
   */
  onSelectionChange: (ids: string[]) => void;
  /**
   * Optional function that returns a status for the row. When provided,
   * the table will show per‑row status badges and aggregate counts.
   */
  getRowStatus?: (row: TRow) => ImportRowStatus | null | undefined;
  /**
   * Optional function to provide searchable text for a row. If omitted,
   * search will be disabled.
   */
  getSearchText?: (row: TRow) => string;
  /**
   * Optional additional content rendered to the right of the search box
   * (e.g. extra filters).
   */
  toolbarExtras?: React.ReactNode;
  /**
   * Optional className for the outer container.
   */
  className?: string;
  /**
   * Optional label used in summary text (e.g. \"pages\", \"sections\").
   */
  entityLabel?: string;
}

export function ImportReviewTable<TRow extends ImportReviewBaseRow>({
  rows,
  columns,
  selectedIds,
  onSelectionChange,
  getRowStatus,
  getSearchText,
  toolbarExtras,
  className,
  entityLabel = 'items',
}: ImportReviewTableProps<TRow>) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ImportRowStatus | 'all'>('all');

  const hasSearch = !!getSearchText;
  const hasStatus = !!getRowStatus;

  const statusCounts = React.useMemo(() => {
    if (!getRowStatus) return { new: 0, existing: 0, conflict: 0, warning: 0 };
    return rows.reduce(
      (acc, row) => {
        const status = getRowStatus(row);
        if (!status) return acc;
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { new: 0, existing: 0, conflict: 0, warning: 0 } as Record<ImportRowStatus, number>
    );
  }, [rows, getRowStatus]);

  const filteredRows = React.useMemo(() => {
    let out = rows;

    if (hasSearch && search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((row) => getSearchText!(row).toLowerCase().includes(q));
    }

    if (hasStatus && statusFilter !== 'all') {
      out = out.filter((row) => getRowStatus!(row) === statusFilter);
    }

    return out;
  }, [rows, hasSearch, search, hasStatus, statusFilter, getSearchText, getRowStatus]);

  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedIds.includes(row.id));
  const someSelected =
    filteredRows.length > 0 &&
    filteredRows.some((row) => selectedIds.includes(row.id));

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      const merged = new Set(selectedIds);
      filteredRows.forEach((row) => merged.add(row.id));
      onSelectionChange(Array.from(merged));
    } else {
      const remaining = selectedIds.filter(
        (id) => !filteredRows.some((row) => row.id === id)
      );
      onSelectionChange(remaining);
    }
  };

  const handleToggleRow = (id: string, checked: boolean) => {
    if (checked) {
      if (!selectedIds.includes(id)) {
        onSelectionChange([...selectedIds, id]);
      }
    } else {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    }
  };

  const renderStatusBadge = (status: ImportRowStatus) => {
    switch (status) {
      case 'new':
        return <Badge variant="secondary">New</Badge>;
      case 'existing':
        return <Badge variant="outline">Existing</Badge>;
      case 'conflict':
        return <Badge variant="destructive">Conflict</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium">
            Review {rows.length} {entityLabel}
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedIds.length} selected
            {hasStatus &&
              ` • ${statusCounts.new} new, ${statusCounts.existing} existing, ${statusCounts.conflict} with conflicts, ${statusCounts.warning} with warnings`}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {hasSearch && (
            <Input
              placeholder={`Search ${entityLabel}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full sm:w-52"
            />
          )}
          {hasStatus && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  'rounded-full px-2 py-1 text-xs',
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-2 py-1 text-xs',
                  statusFilter === 'new'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setStatusFilter('new')}
              >
                New
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-2 py-1 text-xs',
                  statusFilter === 'existing'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setStatusFilter('existing')}
              >
                Existing
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-2 py-1 text-xs',
                  statusFilter === 'conflict'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setStatusFilter('conflict')}
              >
                Conflicts
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-2 py-1 text-xs',
                  statusFilter === 'warning'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setStatusFilter('warning')}
              >
                Warnings
              </button>
            </div>
          )}
          {toolbarExtras}
        </div>
      </div>

      <ScrollArea className="max-h-80 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => handleToggleAll(Boolean(v))}
                  aria-label="Select all"
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }}>
                  {col.header}
                </TableHead>
              ))}
              {hasStatus && <TableHead className="w-32">Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const isSelected = selectedIds.includes(row.id);
              const status = getRowStatus ? getRowStatus(row) : null;
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className={isSelected ? 'bg-muted/60' : undefined}
                >
                  <TableCell className="w-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) =>
                        handleToggleRow(row.id, Boolean(v))
                      }
                      aria-label={`Select ${row.id}`}
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key} style={{ width: col.width }}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                  {hasStatus && (
                    <TableCell className="w-32">
                      {status ? renderStatusBadge(status) : null}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1 + (hasStatus ? 1 : 0)}
                  className="h-16 text-center text-sm text-muted-foreground"
                >
                  No {entityLabel} match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

