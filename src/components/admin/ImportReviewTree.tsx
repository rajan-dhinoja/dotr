/**
 * ImportReviewTree - Hierarchical review list for bulk import selection
 *
 * Displays pages or menu items in a tree structure with:
 * - Recursive tree rendering with expand/collapse
 * - Search, status filter, and sort
 * - Checkbox selection
 * - Flexible scrolling
 */
import * as React from 'react';
import { ChevronRight, ChevronDown, FileText, FolderTree, Link2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ImportRowStatus } from '@/lib/importReviewTree';

export interface ImportReviewTreeColumn<TNode> {
  key: string;
  header: string;
  width?: string | number;
  render: (node: TNode) => React.ReactNode;
}

export type SortOption = 'default' | 'slug-asc' | 'title-asc' | 'label-asc' | 'location';

export interface ImportReviewTreeProps<TNode extends { id: string; level: number; children: TNode[] }> {
  treeNodes: TNode[];
  totalCount: number;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  columns: ImportReviewTreeColumn<TNode>[];
  getRowStatus?: (node: TNode) => ImportRowStatus | null | undefined;
  getSearchText: (node: TNode) => string;
  entityLabel?: string;
  sortOptions?: { value: SortOption; label: string }[];
  getSortKey?: (node: TNode, option: SortOption) => string;
  className?: string;
  scrollHeight?: string;
}

function flattenTree<T extends { id: string; level: number; children: T[] }>(nodes: T[]): T[] {
  const out: T[] = [];
  function walk(ns: T[]) {
    ns.forEach((n) => {
      out.push(n);
      walk(n.children);
    });
  }
  walk(nodes);
  return out;
}

function collectPathToNode<T extends { id: string; children: T[] }>(
  nodes: T[],
  targetId: string,
  path: T[] = []
): T[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return [...path, n];
    const found = collectPathToNode(n.children, targetId, [...path, n]);
    if (found) return found;
  }
  return null;
}

export function ImportReviewTree<TNode extends { id: string; level: number; children: TNode[] }>({
  treeNodes,
  totalCount,
  selectedIds,
  onSelectionChange,
  columns,
  getRowStatus,
  getSearchText,
  entityLabel = 'items',
  sortOptions,
  getSortKey,
  className,
  scrollHeight = 'min-h-[280px] max-h-[50vh]',
}: ImportReviewTreeProps<TNode>) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ImportRowStatus | 'all'>('all');
  const [sortBy, setSortBy] = React.useState<SortOption>('default');
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const hasStatus = !!getRowStatus;

  const allNodes = React.useMemo(() => flattenTree(treeNodes), [treeNodes]);

  // Expand all nodes by default so full hierarchy is visible
  React.useEffect(() => {
    const ids = new Set<string>();
    function collect(nodes: TNode[]) {
      nodes.forEach((n) => {
        if (n.children.length > 0) ids.add(n.id);
        collect(n.children);
      });
    }
    collect(treeNodes);
    setExpandedIds(ids);
  }, [treeNodes]);

  const statusCounts = React.useMemo(() => {
    if (!getRowStatus) return { new: 0, existing: 0, conflict: 0, warning: 0 };
    return allNodes.reduce(
      (acc, node) => {
        const status = getRowStatus(node);
        if (!status) return acc;
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { new: 0, existing: 0, conflict: 0, warning: 0 } as Record<ImportRowStatus, number>
    );
  }, [allNodes, getRowStatus]);

  const matchingIds = React.useMemo(() => {
    let filtered = allNodes;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((node) => getSearchText(node).toLowerCase().includes(q));
    }
    if (hasStatus && statusFilter !== 'all') {
      filtered = filtered.filter((node) => getRowStatus!(node) === statusFilter);
    }
    const matchSet = new Set(filtered.map((n) => n.id));
    const withAncestors = new Set<string>();
    matchSet.forEach((id) => {
      withAncestors.add(id);
      const path = collectPathToNode(treeNodes, id);
      path?.slice(0, -1).forEach((p) => withAncestors.add(p.id));
    });
    return withAncestors;
  }, [allNodes, treeNodes, search, statusFilter, hasStatus, getSearchText, getRowStatus]);

  const sortedRoots = React.useMemo(() => {
    if (sortBy === 'default') return treeNodes;
    if (!getSortKey) return treeNodes;
    const flat = flattenTree(treeNodes);
    flat.sort((a, b) => {
      const ka = getSortKey(a, sortBy);
      const kb = getSortKey(b, sortBy);
      return ka.localeCompare(kb, undefined, { sensitivity: 'base' });
    });
    return flat;
  }, [treeNodes, sortBy, getSortKey]);

  const visibleNodesForRender = React.useMemo(() => {
    const hasFilter = search.trim() || (hasStatus && statusFilter !== 'all');
    if (!hasFilter) return null;
    return matchingIds;
  }, [search, statusFilter, hasStatus, matchingIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const ids = new Set<string>();
    function collect(nodes: TNode[]) {
      nodes.forEach((n) => {
        if (n.children.length > 0) ids.add(n.id);
        collect(n.children);
      });
    }
    collect(treeNodes);
    setExpandedIds(ids);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const filteredNodeIds = React.useMemo(() => {
    if (!visibleNodesForRender) return null;
    return visibleNodesForRender;
  }, [visibleNodesForRender]);

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

  const handleToggleAll = (checked: boolean) => {
    const nodesToConsider = filteredNodeIds
      ? allNodes.filter((n) => filteredNodeIds.has(n.id))
      : allNodes;
    if (checked) {
      const merged = new Set(selectedIds);
      nodesToConsider.forEach((n) => merged.add(n.id));
      onSelectionChange(Array.from(merged));
    } else {
      const exclude = new Set(nodesToConsider.map((n) => n.id));
      onSelectionChange(selectedIds.filter((id) => !exclude.has(id)));
    }
  };

  const handleToggleRow = (id: string, checked: boolean) => {
    if (checked) {
      if (!selectedIds.includes(id)) onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    }
  };

  const allSelectedInView = (() => {
    const nodesToConsider = filteredNodeIds
      ? allNodes.filter((n) => filteredNodeIds.has(n.id))
      : allNodes;
    return nodesToConsider.length > 0 && nodesToConsider.every((n) => selectedIds.includes(n.id));
  })();

  const someSelectedInView = (() => {
    const nodesToConsider = filteredNodeIds
      ? allNodes.filter((n) => filteredNodeIds.has(n.id))
      : allNodes;
    return nodesToConsider.some((n) => selectedIds.includes(n.id));
  })();

  const renderRow = (node: TNode, depth: number, flatMode = false) => {
    const isVisible = !filteredNodeIds || filteredNodeIds.has(node.id);
    if (!isVisible) return null;

    const hasChildren = node.children.length > 0 && !flatMode;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIds.includes(node.id);
    const status = getRowStatus ? getRowStatus(node) : null;

    const childRows = hasChildren && isExpanded
      ? node.children.map((c) => renderRow(c, depth + 1, flatMode))
      : null;

    const indent = 12 + depth * 24;

    // Heuristic to pick an icon + small metadata for different node types
    const nodeAny = node as any;
    const isMenuNode = 'menu_location' in nodeAny;
    const isPageNode = !isMenuNode;
    let NodeIcon: React.ComponentType<{ className?: string }> = FileText;
    if (isMenuNode) NodeIcon = Link2;
    if (hasChildren) NodeIcon = FolderTree;

    return (
      <React.Fragment key={node.id}>
        <TableRow
          data-state={isSelected ? 'selected' : undefined}
          className={cn(
            'group text-sm border-b border-border/40',
            depth === 0 ? 'bg-background' : 'bg-muted/5',
            isSelected && 'bg-primary/5 border-primary/60',
            'hover:bg-muted/40 transition-colors'
          )}
        >
          <TableCell className="w-10 py-2 align-middle">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(v) => handleToggleRow(node.id, Boolean(v))}
              aria-label={`Select ${node.id}`}
            />
          </TableCell>
          <TableCell className="py-2 align-middle" style={{ paddingLeft: indent }}>
            <div className="flex items-center gap-2 min-w-0 text-foreground">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(node.id)}
                  className="p-0.5 rounded hover:bg-muted -m-0.5 shrink-0 transition-colors"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <span className="w-5 shrink-0" aria-hidden />
              )}

              {/* Type icon */}
              <NodeIcon className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />

              {/* Main label */}
              <span className="truncate font-medium leading-snug">
                {columns[0] ? columns[0].render(node) : null}
              </span>

              {/* Extra context chip for menu items */}
              {isMenuNode && (
                <span className="ml-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                  {String(nodeAny.menu_location ?? '').toLowerCase() || 'menu'}
                </span>
              )}
            </div>
          </TableCell>
          {columns.slice(1).map((col) => (
            <TableCell
              key={col.key}
              className="py-2 text-xs text-foreground/70 group-data-[state=selected]:text-foreground align-middle"
              style={{ width: col.width }}
            >
              <span className="truncate block">
                {col.render(node)}
              </span>
            </TableCell>
          ))}
          {hasStatus && (
            <TableCell className="w-20 min-w-[4.5rem] py-2 shrink-0 text-right align-middle">
              {status ? renderStatusBadge(status) : null}
            </TableCell>
          )}
        </TableRow>
        {childRows}
      </React.Fragment>
    );
  };

  const renderRowsFromNodes = (nodes: TNode[], depth: number, flat = false): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    nodes.forEach((node) => {
      const rendered = renderRow(node, depth, flat);
      if (rendered) rows.push(rendered);
    });
    return rows;
  };

  const visibleNodesInTreeOrder = React.useMemo(() => {
    if (!filteredNodeIds) return null;
    const out: TNode[] = [];
    function walk(nodes: TNode[]) {
      nodes.forEach((node) => {
        if (filteredNodeIds.has(node.id)) out.push(node);
        walk(node.children);
      });
    }
    walk(treeNodes);
    return out;
  }, [treeNodes, filteredNodeIds]);

  const rowsToShow =
    filteredNodeIds && visibleNodesInTreeOrder
      ? visibleNodesInTreeOrder.map((node) => renderRow(node, node.level, false))
      : sortBy === 'default'
        ? renderRowsFromNodes(sortedRoots, 0, false)
        : sortedRoots.map((node) => renderRow(node, node.level, true));

  const emptyResult = filteredNodeIds
    ? visibleNodesInTreeOrder?.length === 0
    : false;

  return (
    <div className={cn('space-y-3 min-w-0', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium">
            Review {totalCount} {entityLabel}
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedIds.length} selected
            {hasStatus &&
              ` • ${statusCounts.new} new, ${statusCounts.existing} existing, ${statusCounts.conflict} with conflicts, ${statusCounts.warning} with warnings`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={`Search ${entityLabel}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full sm:w-48"
          />
          {hasStatus && (
            <div className="flex items-center gap-1">
              {(['all', 'new', 'existing', 'conflict', 'warning'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={cn(
                    'rounded-full px-2 py-1 text-xs',
                    statusFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'conflict' ? 'Conflicts' : f === 'warning' ? 'Warnings' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
          {sortOptions && sortOptions.length > 0 && (
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!filteredNodeIds && (
            <>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                onClick={expandAll}
              >
                Expand all
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                onClick={collapseAll}
              >
                Collapse all
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          'rounded-md border overflow-y-auto overflow-x-auto min-h-[200px] w-full min-w-0',
          scrollHeight
        )}
      >
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelectedInView}
                  onCheckedChange={(v) => handleToggleAll(Boolean(v))}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>{columns[0]?.header ?? 'Item'}</TableHead>
              {columns.slice(1).map((col) => (
                <TableHead key={col.key} style={{ width: col.width }}>
                  {col.header}
                </TableHead>
              ))}
              {hasStatus && <TableHead className="w-20 min-w-[4.5rem]">Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsToShow}
            {emptyResult && (
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
      </div>
    </div>
  );
}
