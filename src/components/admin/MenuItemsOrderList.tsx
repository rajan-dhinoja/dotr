import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GripVertical, Link2, LayoutGrid, LayoutList, Pencil, Trash2, Eye, EyeOff, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTypeBadgeColor, getTypeBadgeLabel, getLevelLabel, getLevelColor } from '@/components/admin/PagesNavigationList';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAdminMenuItems, type AdminMenuItemNode, type MenuItemReorderUpdate } from '@/hooks/useAdminMenuItems';

export type { MenuItemReorderUpdate };

const SLOT_PREFIX = 'slot|';
function slotId(parentId: string | null, index: number): string {
  return `${SLOT_PREFIX}${parentId ?? 'root'}|${index}`;
}
function parseSlotId(id: string): { parentId: string | null; index: number } | null {
  if (!id.startsWith(SLOT_PREFIX)) return null;
  const rest = id.slice(SLOT_PREFIX.length);
  const lastPipe = rest.lastIndexOf('|');
  if (lastPipe === -1) return null;
  const parentKey = rest.slice(0, lastPipe);
  const index = parseInt(rest.slice(lastPipe + 1), 10);
  if (Number.isNaN(index)) return null;
  return { parentId: parentKey === 'root' ? null : parentKey, index };
}

function cloneTree(nodes: AdminMenuItemNode[]): AdminMenuItemNode[] {
  return nodes.map((n) => ({ ...n, children: cloneTree(n.children) }));
}
function findParentOf(nodes: AdminMenuItemNode[], childId: string): AdminMenuItemNode | null {
  for (const n of nodes) {
    if (n.children.some((c) => c.id === childId)) return n;
    const found = findParentOf(n.children, childId);
    if (found) return found;
  }
  return null;
}
function removeFromTree(nodes: AdminMenuItemNode[], id: string): AdminMenuItemNode | null {
  const parent = findParentOf(nodes, id);
  const list = parent ? parent.children : nodes;
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  return removed;
}
function findInTree(nodes: AdminMenuItemNode[], id: string): AdminMenuItemNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findInTree(n.children, id);
    if (found) return found;
  }
  return null;
}
function isDescendantOf(nodes: AdminMenuItemNode[], descendantId: string, ancestorId: string): boolean {
  const ancestor = findInTree(nodes, ancestorId);
  if (!ancestor) return false;
  const check = (n: AdminMenuItemNode): boolean => {
    if (n.id === descendantId) return true;
    return n.children.some(check);
  };
  return ancestor.children.some(check);
}
function insertIntoTree(
  nodes: AdminMenuItemNode[],
  parentId: string | null,
  index: number,
  node: AdminMenuItemNode
): void {
  node.parent_id = parentId;
  if (parentId === null) {
    nodes.splice(index, 0, node);
    return;
  }
  const parent = findInTree(nodes, parentId);
  if (!parent) return;
  parent.children.splice(index, 0, node);
}
function flattenTree(nodes: AdminMenuItemNode[]): MenuItemReorderUpdate[] {
  const out: MenuItemReorderUpdate[] = [];
  let order = 0;
  function walk(ns: AdminMenuItemNode[], level: number) {
    ns.forEach((n) => {
      out.push({
        id: n.id,
        parent_id: n.parent_id,
        display_order: order++,
        item_level: level,
      });
      walk(n.children, level + 1);
    });
  }
  walk(nodes, 0);
  return out;
}

/** Resolve slot (parentId, index) from displayed/filtered tree to the correct insert index in the full tree */
function getFullTreeInsertIndex(
  fullTree: AdminMenuItemNode[],
  displayedTree: AdminMenuItemNode[],
  parentId: string | null,
  slotIndexInDisplayed: number
): number {
  const fullChildren = parentId
    ? (findInTree(fullTree, parentId)?.children ?? [])
    : fullTree;
  const displayedChildren = parentId
    ? (findInTree(displayedTree, parentId)?.children ?? [])
    : displayedTree;
  if (slotIndexInDisplayed >= displayedChildren.length) return fullChildren.length;
  const targetId = displayedChildren[slotIndexInDisplayed].id;
  const fullIndex = fullChildren.findIndex((c) => c.id === targetId);
  return fullIndex === -1 ? fullChildren.length : fullIndex;
}

function SortableMenuItemCard({
  node,
  depth,
  renderChildren,
  onEditPage,
  onRemoveFromMenu,
  onEditSectionLink,
  onToggleVisibility,
  isVisibilityPending,
  onTogglePageVisibility,
  isPageVisibilityPending,
  onTogglePageInNav,
  isPageNavPending,
  isSelected,
  onSelectChange,
  onDeletePage,
  pageLevelByPageId,
}: {
  node: AdminMenuItemNode;
  /** Depth in the tree (used for empty drop zone indent) */
  depth: number;
  renderChildren?: () => React.ReactNode;
  onEditPage?: (pageId: string) => void;
  onRemoveFromMenu?: (menuItemId: string, node?: AdminMenuItemNode) => void;
  onEditSectionLink?: (item: AdminMenuItemNode) => void;
  onToggleVisibility?: (menuItemId: string, is_active: boolean) => void;
  isVisibilityPending?: boolean;
  onTogglePageVisibility?: (pageId: string, is_active: boolean) => void;
  isPageVisibilityPending?: boolean;
  onTogglePageInNav?: (pageId: string, show_in_navigation: boolean) => void;
  isPageNavPending?: boolean;
  isSelected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onDeletePage?: (pageId: string, node: AdminMenuItemNode) => void;
  pageLevelByPageId?: Record<string, number>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const isSectionLink = !!(node.section_anchor ?? node.section_id);
  const hasPage = !!node.page_id && !!node.page;
  const pageSlug = node.page?.slug;
  const pageSourceType = node.page?.source_entity_type ?? null;
  const href = pageSlug === 'home' ? '/' : pageSlug ? `/${pageSlug}` : node.url || '#';
  const sub = node.section_anchor ? `#${node.section_anchor}` : '';
  const isVisible = node.is_active ?? true;
  const pageIsActive = node.page?.is_active ?? true;
  const pageInNav = node.page?.show_in_navigation ?? true;
  const pageLevel = node.page_id && pageLevelByPageId ? pageLevelByPageId[node.page_id] : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <CardContent className="p-3 flex items-center gap-3">
        {onSelectChange != null && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelectChange}
            aria-label={`Select ${node.label}`}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none rounded p-0.5 -m-0.5"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-foreground/60" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{node.label}</p>
            {pageSourceType && (
              <Badge
                variant="outline"
                className={cn('text-xs gap-1 border', getTypeBadgeColor(pageSourceType))}
              >
                {(pageSourceType === 'service_category' || pageSourceType === 'service') && (
                  <Link2 className="h-3 w-3" />
                )}
                {getTypeBadgeLabel(pageSourceType)}
              </Badge>
            )}
            {isSectionLink && (
              <Badge variant="outline" className="text-xs gap-1">
                <Link2 className="h-3 w-3" />
                Section link
              </Badge>
            )}
            {node.menu_type === 'mega' && (
              <Badge variant="secondary" className="text-xs">Mega</Badge>
            )}
            {pageLevel !== undefined ? (
              <Badge variant="outline" className={cn('text-xs border', getLevelColor(pageLevel))} title="Page tree level">
                Page: {getLevelLabel(pageLevel)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn('text-xs border', getLevelColor(node.level))}
                title="Menu level"
              >
                {getLevelLabel(node.level)}
              </Badge>
            )}
            {onToggleVisibility && (
              <Badge
                variant={isVisible ? 'default' : 'secondary'}
                className="text-xs"
              >
                {isVisible ? 'Visible' : 'Hidden'}
              </Badge>
            )}
            {!isSectionLink && hasPage && onTogglePageInNav && (
              <Badge
                variant={pageInNav ? 'default' : 'secondary'}
                className="text-xs cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTogglePageInNav(node.page_id!, !pageInNav);
                }}
                title="Page: show in nav (for Sync)"
              >
                {pageInNav ? 'In nav' : 'Not in nav'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {href}{sub}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleVisibility(node.id, !isVisible)}
              disabled={isVisibilityPending}
              title={isVisible ? 'Hide from menu' : 'Show in menu'}
              className="shrink-0"
            >
              {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
          )}
          {!isSectionLink && hasPage && onTogglePageVisibility && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePageVisibility(node.page_id!, !pageIsActive)}
              disabled={isPageVisibilityPending}
              title={pageIsActive ? 'Unpublish page' : 'Publish page'}
              className="shrink-0"
            >
              {pageIsActive ? <Globe className="h-4 w-4" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
            </Button>
          )}
          {isSectionLink && node.section_id && pageSlug && (
            <>
              {onEditSectionLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditSectionLink(node)}
                  className="gap-1.5"
                >
                  <Pencil className="h-4 w-4" />
                  Edit link
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link
                  to={`/admin/page-sections?page=${encodeURIComponent(pageSlug)}&section=${encodeURIComponent(
                    node.section_id
                  )}`}
                  className="gap-1.5"
                >
                  <Pencil className="h-4 w-4" />
                  Edit section
                </Link>
              </Button>
            </>
          )}
          {!isSectionLink && hasPage && onEditPage && (
            <Button variant="ghost" size="sm" onClick={() => onEditPage(node.page_id!)} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Edit page
            </Button>
          )}
          {!isSectionLink && hasPage && pageSlug && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/admin/page-sections?page=${encodeURIComponent(pageSlug)}`} className="gap-1.5">
                <LayoutGrid className="h-4 w-4" />
                Sections
              </Link>
            </Button>
          )}
          {onRemoveFromMenu && (hasPage && !isSectionLink && onDeletePage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remove or delete"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onRemoveFromMenu(node.id, node)}
                >
                  Remove from menu
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeletePage(node.page_id!, node)}
                  className="text-destructive focus:text-destructive"
                >
                  Delete page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveFromMenu(node.id, node)}
              title="Remove from menu"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </CardContent>
      {node.children.length > 0 && renderChildren != null ? (
        <div className="pb-2">{renderChildren()}</div>
      ) : (
        <div className={cn('pb-2 min-h-8', depth > 0 && 'pl-6')}>
          <SlotDroppable
            id={slotId(node.id, 0)}
            parentId={node.id}
            index={0}
            depth={depth}
            isRootSlot={false}
          />
        </div>
      )}
    </Card>
  );
}

function SlotDroppable({
  id,
  depth,
  isRootSlot,
}: {
  id: string;
  parentId: string | null;
  index: number;
  depth: number;
  isRootSlot?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[10px] rounded transition-colors -my-0.5 py-1',
        depth > 0 && 'ml-6',
        isOver && 'bg-primary/20 ring-1 ring-primary/40',
        isRootSlot && isOver && 'bg-primary/15'
      )}
      data-slot-droppable
    >
      {isRootSlot && isOver && (
        <span className="text-xs text-muted-foreground px-2">Drop here for top level</span>
      )}
    </div>
  );
}

function MenuItemOverlay({ node }: { node: AdminMenuItemNode | undefined }) {
  if (!node) return null;
  const isSectionLink = !!(node.section_anchor ?? node.section_id);
  const pageSlug = node.page?.slug;
  const pageSourceType = node.page?.source_entity_type ?? null;
  const href = pageSlug === 'home' ? '/' : pageSlug ? `/${pageSlug}` : node.url || '#';
  const sub = node.section_anchor ? `#${node.section_anchor}` : '';
  return (
    <Card className="shadow-lg ring-2 ring-primary/20">
      <CardContent className="p-3 flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-foreground/60" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{node.label}</p>
            {pageSourceType && (
              <Badge
                variant="outline"
                className={cn('text-xs gap-1 border', getTypeBadgeColor(pageSourceType))}
              >
                {(pageSourceType === 'service_category' || pageSourceType === 'service') && (
                  <Link2 className="h-3 w-3" />
                )}
                {getTypeBadgeLabel(pageSourceType)}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn('text-xs border', getLevelColor(node.level))}
            >
              {getLevelLabel(node.level)}
            </Badge>
            {(node.menu_type === 'mega' || (node.level === 0 && (node.children?.length ?? 0) > 0)) && (
              <Badge variant="secondary" className="text-xs">Mega</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{href}{sub}</p>
        </div>
        {isSectionLink && (
          <Badge variant="outline" className="text-xs">Section link</Badge>
        )}
      </CardContent>
    </Card>
  );
}

export interface MenuItemsOrderListProps {
  menuLocation: string;
  onReorder: (updates: MenuItemReorderUpdate[]) => void;
  isReordering?: boolean;
  /** When set, show Edit page / Sections / Remove from menu on each item */
  onEditPage?: (pageId: string) => void;
  onRemoveFromMenu?: (menuItemId: string, node?: AdminMenuItemNode) => void;
  onEditSectionLink?: (item: AdminMenuItemNode) => void;
  /** Toggle menu item visibility (show/hide in nav). Updates menu_items.is_active */
  onToggleVisibility?: (menuItemId: string, is_active: boolean) => void;
  isVisibilityPending?: boolean;
  /** Toggle page published state. Updates pages.is_active. For page-link rows only. */
  onTogglePageVisibility?: (pageId: string, is_active: boolean) => void;
  isPageVisibilityPending?: boolean;
  /** Toggle page "In nav" flag. Updates pages.show_in_navigation. For page-link rows only. */
  onTogglePageInNav?: (pageId: string, show_in_navigation: boolean) => void;
  isPageNavPending?: boolean;
  /** Delete the underlying page (with confirm in parent). For page-link rows only. */
  onDeletePage?: (pageId: string, node: AdminMenuItemNode) => void;
  /** Bulk selection: selected menu item IDs */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Page tree level by page id (for "Page: Top/Category/Service" badge) */
  pageLevelByPageId?: Record<string, number>;
  /** Optional filter function to filter menu items */
  filterFn?: (node: AdminMenuItemNode) => boolean;
  /** Optional search string; filters list by label, page title, page slug (keeps ancestors of matches) */
  searchQuery?: string;
  /** Display sort: default (saved order), label-asc, label-desc. Does not change saved order. */
  sortBy?: 'default' | 'label-asc' | 'label-desc';
  /** Called after reorder mutation succeeds (e.g. to sync menu order to pages) */
  onAfterReorder?: () => void;
}

function sortTreeForDisplay(
  nodes: AdminMenuItemNode[],
  sortBy: 'label-asc' | 'label-desc'
): AdminMenuItemNode[] {
  const getLabel = (n: AdminMenuItemNode) => (n.label ?? n.page?.title ?? '').toLowerCase();
  const cmp = (a: AdminMenuItemNode, b: AdminMenuItemNode) => {
    const la = getLabel(a);
    const lb = getLabel(b);
    const c = la.localeCompare(lb, undefined, { sensitivity: 'base' });
    return sortBy === 'label-desc' ? -c : c;
  };
  return [...nodes]
    .sort(cmp)
    .map((node) => ({
      ...node,
      children: sortTreeForDisplay(node.children, sortBy),
    }));
}

function filterTree(nodes: AdminMenuItemNode[], filterFn: (node: AdminMenuItemNode) => boolean): AdminMenuItemNode[] {
  return nodes
    .filter(filterFn)
    .map((node) => ({
      ...node,
      children: filterTree(node.children, filterFn),
    }));
}

/** Filter tree to nodes that match search or are ancestors of a matching node */
function filterTreeBySearch(nodes: AdminMenuItemNode[], q: string): AdminMenuItemNode[] {
  const lower = q.trim().toLowerCase();
  if (!lower) return nodes;
  function nodeMatches(node: AdminMenuItemNode): boolean {
    const label = (node.label || '').toLowerCase();
    const title = (node.page?.title || '').toLowerCase();
    const slug = (node.page?.slug || '').toLowerCase();
    const url = (node.url || '').toLowerCase();
    return label.includes(lower) || title.includes(lower) || slug.includes(lower) || url.includes(lower);
  }
  function walk(ns: AdminMenuItemNode[]): AdminMenuItemNode[] {
    return ns
      .map((node) => ({
        ...node,
        children: walk(node.children),
      }))
      .filter((node) => nodeMatches(node) || node.children.length > 0);
  }
  return walk(nodes);
}

export function MenuItemsOrderList({
  menuLocation,
  onReorder,
  onEditPage,
  onRemoveFromMenu,
  onEditSectionLink,
  onToggleVisibility,
  isVisibilityPending,
  onTogglePageVisibility,
  isPageVisibilityPending,
  onTogglePageInNav,
  isPageNavPending,
  onDeletePage,
  selectedIds = [],
  onSelectionChange,
  pageLevelByPageId,
  filterFn,
  searchQuery,
  sortBy = 'default',
  onAfterReorder,
}: MenuItemsOrderListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localTree, setLocalTree] = useState<AdminMenuItemNode[] | null>(null);

  const { data, isLoading, reorderMutation } = useAdminMenuItems(menuLocation);
  const rawTree = localTree ?? data?.tree ?? [];
  const treeAfterSearch = useMemo(
    () => (searchQuery ? filterTreeBySearch(rawTree, searchQuery) : rawTree),
    [rawTree, searchQuery]
  );
  const treeFiltered = filterFn ? filterTree(treeAfterSearch, filterFn) : treeAfterSearch;
  const tree = useMemo(
    () =>
      sortBy && sortBy !== 'default'
        ? sortTreeForDisplay(treeFiltered, sortBy)
        : treeFiltered,
    [treeFiltered, sortBy]
  );
  const flatOrder = useMemo(() => flattenTree(tree), [tree]);
  const allIds = useMemo(() => flatOrder.map((p) => p.id), [flatOrder]);
  const showSelection = !!onSelectionChange;
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;

  const handleSelectAll = (checked: boolean) => {
    onSelectionChange?.(checked ? allIds : []);
  };
  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedIds, id]);
    } else {
      onSelectionChange?.(selectedIds.filter((s) => s !== id));
    }
  };

  const getSiblings = (id: string): AdminMenuItemNode[] => {
    const node = findInTree(tree, id);
    if (!node) return [];
    const parent = node.parent_id ? findInTree(tree, node.parent_id) : null;
    return parent ? parent.children : tree;
  };
  const getSiblingIds = (id: string): string[] => getSiblings(id).map((s) => s.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragCancel = () => setActiveId(null);
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Always work on the full tree so persisted parent_id/display_order stay consistent (e.g. when search/filter is active)
    const treeCopy = cloneTree(rawTree);
    const removed = removeFromTree(treeCopy, activeId);
    if (!removed) return;

    const slot = parseSlotId(overId);
    if (slot) {
      const insertIndex = getFullTreeInsertIndex(rawTree, tree, slot.parentId, slot.index);
      insertIntoTree(treeCopy, slot.parentId, insertIndex, removed);
      const updates = flattenTree(treeCopy);
      setLocalTree(treeCopy);
      reorderMutation.mutate(updates, {
        onSuccess: () => {
          setLocalTree(null);
          onAfterReorder?.();
        },
        onError: () => setLocalTree(null),
      });
      onReorder(updates);
      return;
    }

    const siblingIds = getSiblingIds(activeId);
    const overIsSibling = siblingIds.includes(overId);

    if (overIsSibling) {
      const fullParent = findParentOf(treeCopy, overId);
      const fullSiblings = fullParent ? fullParent.children : treeCopy;
      const newIndex = fullSiblings.findIndex((s) => s.id === overId);
      if (newIndex === -1) return;
      insertIntoTree(treeCopy, fullParent?.id ?? null, newIndex, removed);
      const updates = flattenTree(treeCopy);
      setLocalTree(treeCopy);
      reorderMutation.mutate(updates, {
        onSuccess: () => {
          setLocalTree(null);
          onAfterReorder?.();
        },
        onError: () => setLocalTree(null),
      });
      onReorder(updates);
      return;
    }

    if (overId === activeId) return;
    if (isDescendantOf(rawTree, overId, activeId)) return;
    const overNode = findInTree(treeCopy, overId);
    if (!overNode) return;
    insertIntoTree(treeCopy, overId, overNode.children.length, removed);
    const updates = flattenTree(treeCopy);
    setLocalTree(treeCopy);
    reorderMutation.mutate(updates, {
      onSuccess: () => {
        setLocalTree(null);
        onAfterReorder?.();
      },
      onError: () => setLocalTree(null),
    });
    onReorder(updates);
  };

  const findNodeById = (nodes: AdminMenuItemNode[], id: string): AdminMenuItemNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
    return undefined;
  };
  const activeNode = activeId ? findNodeById(tree, activeId) : undefined;

  const renderTree = (nodes: AdminMenuItemNode[], depth: number, parentId: string | null = null): React.ReactNode => {
    const isRoot = depth === 0;
    return (
      <div className={depth === 0 ? 'space-y-1' : 'space-y-1 pl-6'}>
        {nodes.map((node, index) => (
          <div key={`row-${node.id}`} className="space-y-1">
            <SlotDroppable
              id={slotId(parentId, index)}
              parentId={parentId}
              index={index}
              depth={depth}
              isRootSlot={isRoot}
            />
            <SortableMenuItemCard
              node={node}
              depth={depth + 1}
              onEditPage={onEditPage}
              onRemoveFromMenu={onRemoveFromMenu}
              onEditSectionLink={onEditSectionLink}
              onToggleVisibility={onToggleVisibility}
              isVisibilityPending={isVisibilityPending}
              onTogglePageVisibility={onTogglePageVisibility}
              isPageVisibilityPending={isPageVisibilityPending}
              onTogglePageInNav={onTogglePageInNav}
              isPageNavPending={isPageNavPending}
              onDeletePage={onDeletePage}
              pageLevelByPageId={pageLevelByPageId}
              isSelected={showSelection ? selectedIds.includes(node.id) : undefined}
              onSelectChange={showSelection ? (checked) => handleSelectRow(node.id, !!checked) : undefined}
              renderChildren={
                node.children.length > 0
                  ? () => renderTree(node.children, depth + 1, node.id)
                  : undefined
              }
            />
          </div>
        ))}
        <SlotDroppable
          id={slotId(parentId, nodes.length)}
          parentId={parentId}
          index={nodes.length}
          depth={depth}
          isRootSlot={isRoot}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Loading menu items...
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
          <LayoutList className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No menu items yet</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Use &quot;Sync Pages to Menu&quot; above to build the menu from your pages, or add section links. Then you can reorder here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showSelection && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
          />
          <span className="text-sm text-muted-foreground">
            Select all ({allIds.length} menu items)
          </span>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
          {renderTree(tree, 0)}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeNode ? <MenuItemOverlay node={activeNode} /> : null}
        </DragOverlay>
      </DndContext>
      {reorderMutation.isPending && (
        <p className="text-xs text-muted-foreground">Saving order...</p>
      )}
    </div>
  );
}
