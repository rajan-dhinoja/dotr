import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { GripVertical, Pencil, Trash2, Eye, EyeOff, LayoutList, Link2, LayoutGrid, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface PageForNav {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean | null;
  show_in_navigation: boolean | null;
  navigation_label_override: string | null;
  display_order: number | null;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
}

export interface PageTreeNode extends PageForNav {
  children: PageTreeNode[];
  level: number;
}

function buildTree(pages: PageForNav[]): PageTreeNode[] {
  const byId = new Map<string, PageTreeNode>();
  pages.forEach((p) => {
    byId.set(p.id, { ...p, children: [], level: 0 });
  });
  const roots: PageTreeNode[] = [];
  byId.forEach((item) => {
    const node = item as PageTreeNode;
    if (node.parent_id && byId.has(node.parent_id)) {
      const parent = byId.get(node.parent_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const assignLevel = (nodes: PageTreeNode[], level: number) => {
    nodes.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    nodes.forEach((n) => {
      n.level = level;
      assignLevel(n.children, level + 1);
    });
  };
  assignLevel(roots, 0);
  return roots;
}

function flattenTree(nodes: PageTreeNode[]): PageForNav[] {
  const out: PageForNav[] = [];
  function walk(ns: PageTreeNode[]) {
    ns.forEach((n) => {
      const { children, level, ...rest } = n;
      out.push(rest);
      walk(children);
    });
  }
  walk(nodes);
  return out;
}

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

function cloneTree(nodes: PageTreeNode[]): PageTreeNode[] {
  return nodes.map((n) => ({
    ...n,
    children: cloneTree(n.children),
  }));
}

function findParentOf(nodes: PageTreeNode[], childId: string): PageTreeNode | null {
  for (const n of nodes) {
    if (n.children.some((c) => c.id === childId)) return n;
    const found = findParentOf(n.children, childId);
    if (found) return found;
  }
  return null;
}

function removeFromTree(nodes: PageTreeNode[], id: string): PageTreeNode | null {
  const parent = findParentOf(nodes, id);
  const list = parent ? parent.children : nodes;
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  return removed;
}

function findInTree(nodes: PageTreeNode[], id: string): PageTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findInTree(n.children, id);
    if (found) return found;
  }
  return null;
}

function isDescendantOf(nodes: PageTreeNode[], descendantId: string, ancestorId: string): boolean {
  const ancestor = findInTree(nodes, ancestorId);
  if (!ancestor) return false;
  const check = (n: PageTreeNode): boolean => {
    if (n.id === descendantId) return true;
    return n.children.some(check);
  };
  return ancestor.children.some(check);
}

function insertIntoTree(
  nodes: PageTreeNode[],
  parentId: string | null,
  index: number,
  node: PageTreeNode
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

export function getLevelLabel(level: number): string {
  switch (level) {
    case 0:
      return 'Top';
    case 1:
      return 'Category';
    case 2:
      return 'Service';
    default:
      return 'Sub';
  }
}

export function getLevelColor(level: number): string {
  switch (level) {
    case 0:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 1:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 2:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

export function getTypeBadgeLabel(source_entity_type: string | null | undefined): string {
  if (!source_entity_type) return '';
  switch (source_entity_type) {
    case 'service_category':
      return 'Category';
    case 'service':
      return 'Service';
    case 'about':
      return 'About';
    case 'contact':
      return 'Contact';
    case 'portfolio':
      return 'Portfolio';
    case 'blog':
      return 'Blog';
    case 'testimonials':
      return 'Testimonials';
    default:
      return source_entity_type.charAt(0).toUpperCase() + source_entity_type.slice(1).replace(/_/g, ' ');
  }
}

export function getTypeBadgeColor(source_entity_type: string | null | undefined): string {
  if (!source_entity_type) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  switch (source_entity_type) {
    case 'service_category':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800';
    case 'service':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
    case 'about':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
    case 'contact':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800';
    case 'portfolio':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800';
    case 'blog':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800';
    case 'testimonials':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800';
  }
}

interface SortablePageCardProps {
  node: PageTreeNode;
  isSelected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onToggleInNav: () => void;
  isVisibilityPending?: boolean;
  isNavPending?: boolean;
  renderChildren?: () => React.ReactNode;
}

function SortablePageCard({
  node,
  isSelected = false,
  onSelectChange,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleInNav,
  isVisibilityPending,
  isNavPending,
  renderChildren,
}: SortablePageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const inNav = node.show_in_navigation ?? true;
  const isActive = node.is_active ?? true;
  const label = node.navigation_label_override || node.title;
  const url = node.slug === 'home' ? '/' : `/${node.slug}`;
  const hasChildren = node.children.length > 0;
  const isMega = node.level === 0 && hasChildren;

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
            aria-label={`Select ${node.title}`}
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
            <p className="font-medium truncate">{label}</p>
            {node.source_entity_type && (
              <Badge
                variant="outline"
                className={cn('text-xs gap-1 border', getTypeBadgeColor(node.source_entity_type))}
              >
                {(node.source_entity_type === 'service_category' || node.source_entity_type === 'service') && (
                  <Link2 className="h-3 w-3" />
                )}
                {getTypeBadgeLabel(node.source_entity_type)}
              </Badge>
            )}
            <Badge
              variant={inNav ? 'default' : 'secondary'}
              className="text-xs cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleInNav();
              }}
            >
              {inNav ? 'In nav' : 'Hidden'}
            </Badge>
            {!isActive && (
              null
            )}
          </div>
          <p className="text-xs text-foreground/70 mt-0.5">{url || 'No link'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Page visibility (publish/unpublish) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleVisibility}
            disabled={isVisibilityPending}
            title={isActive ? 'Unpublish page' : 'Publish page'}
          >
            {isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-foreground/60" />}
          </Button>

          {/* Visit page on site */}
          <Button variant="ghost" size="icon" asChild>
            <Link
              to={url || '#'}
              target="_blank"
              rel="noreferrer"
              title="Visit page"
            >
              <Globe className="h-4 w-4" />
            </Link>
          </Button>

          {/* Sections manager */}
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/page-sections?page=${encodeURIComponent(node.slug)}`} className="gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              Sections
            </Link>
          </Button>

          {/* Edit page */}
          <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1.5">
            <Pencil className="h-4 w-4" />
            Edit page
          </Button>

          {/* Delete page */}
          <Button variant="ghost" size="icon" onClick={onDelete} title="Delete page">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
      {renderChildren != null && <div className="pb-2">{renderChildren()}</div>}
    </Card>
  );
}

function SlotDroppable({
  id,
  parentId,
  index,
  depth,
}: {
  id: string;
  parentId: string | null;
  index: number;
  depth: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[6px] rounded transition-colors',
        depth > 0 && 'ml-6',
        isOver && 'bg-primary/20 ring-1 ring-primary/40'
      )}
      data-slot-index={index}
    />
  );
}

function PageCardOverlay({ node }: { node: PageTreeNode | undefined }) {
  if (!node) return null;
  const label = node.navigation_label_override || node.title;
  const url = node.slug === 'home' ? '/' : `/${node.slug}`;
  const hasChildren = node.children.length > 0;
  const isMega = node.level === 0 && hasChildren;
  return (
    <Card className="shadow-lg ring-2 ring-primary/20">
      <CardContent className="p-3 flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-foreground/60" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{label}</p>
            {node.source_entity_type && (
              <Badge
                variant="outline"
                className={cn('text-xs gap-1 border', getTypeBadgeColor(node.source_entity_type))}
              >
                {(node.source_entity_type === 'service_category' || node.source_entity_type === 'service') && (
                  <Link2 className="h-3 w-3" />
                )}
                {getTypeBadgeLabel(node.source_entity_type)}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-xs', getLevelColor(node.level))}>
              {getLevelLabel(node.level)}
            </Badge>
            {isMega && (
              <Badge variant="secondary" className="text-xs">
                Mega
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground/70 mt-0.5">{url || 'No link'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface PagesNavigationListProps {
  pages: PageForNav[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onReorder: (reorderedFlatPages: PageForNav[]) => void;
  onEdit: (page: PageForNav) => void;
  onDelete: (page: PageForNav) => void;
  onToggleVisibility: (id: string, is_active: boolean) => void;
  onToggleInNav: (id: string, show_in_navigation: boolean) => void;
  isVisibilityPending?: boolean;
  isNavPending?: boolean;
  emptyMessage?: string;
}

export function PagesNavigationList({
  pages,
  selectedIds = [],
  onSelectionChange,
  onReorder,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleInNav,
  isVisibilityPending,
  isNavPending,
  emptyMessage = 'No pages found',
}: PagesNavigationListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(pages), [pages]);
  const flatOrder = useMemo(() => flattenTree(tree), [tree]);
  const allIds = useMemo(() => flatOrder.map((p) => p.id), [flatOrder]);

  const getSiblings = (id: string): PageForNav[] => {
    const node = flatOrder.find((p) => p.id === id);
    if (!node) return [];
    const parentId = node.parent_id ?? null;
    return flatOrder.filter((p) => (p.parent_id ?? null) === parentId);
  };

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

    // Drop on a slot: insert at (parentId, index)
    const slot = parseSlotId(overId);
    if (slot) {
      const treeCopy = cloneTree(tree);
      const removed = removeFromTree(treeCopy, activeId);
      if (!removed) return;
      insertIntoTree(treeCopy, slot.parentId, slot.index, removed);
      onReorder(flattenTree(treeCopy));
      return;
    }

    // Drop on a card
    const siblings = getSiblings(activeId);
    const overIsSibling = siblings.some((s) => s.id === overId);

    if (overIsSibling) {
      // Reorder within same level
      const oldIndex = siblings.findIndex((s) => s.id === activeId);
      const newIndex = siblings.findIndex((s) => s.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex);
      const siblingIds = new Set(reorderedSiblings.map((s) => s.id));
      let start = -1;
      let end = -1;
      flatOrder.forEach((p, i) => {
        if (siblingIds.has(p.id)) {
          if (start === -1) start = i;
          end = i;
        }
      });
      if (start === -1 || end === -1) return;
      const newFlat = [
        ...flatOrder.slice(0, start),
        ...reorderedSiblings,
        ...flatOrder.slice(end + 1),
      ];
      onReorder(newFlat);
      return;
    }

    // Make active a child of over (reparent). Prevent cycle: over must not be active or descendant of active
    if (overId === activeId) return;
    if (isDescendantOf(tree, overId, activeId)) return;
    const treeCopy = cloneTree(tree);
    const removed = removeFromTree(treeCopy, activeId);
    if (!removed) return;
    const overNode = findInTree(treeCopy, overId);
    if (!overNode) return;
    const insertIndex = overNode.children.length;
    insertIntoTree(treeCopy, overId, insertIndex, removed);
    onReorder(flattenTree(treeCopy));
  };

  const findNodeById = (nodes: PageTreeNode[], id: string): PageTreeNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
    return undefined;
  };
  const activeNode = activeId ? findNodeById(tree, activeId) : undefined;

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

  const allSelected = pages.length > 0 && selectedIds.length === allIds.length;
  const showSelection = !!onSelectionChange;

  const renderTree = (nodes: PageTreeNode[], depth: number, parentId: string | null = null): React.ReactNode => {
    return (
      <div className={depth === 0 ? 'space-y-1' : 'space-y-1 pl-6'}>
        {nodes.map((node, index) => (
          <div key={`row-${node.id}`} className="space-y-1">
            <SlotDroppable
              id={slotId(parentId, index)}
              parentId={parentId}
              index={index}
              depth={depth}
            />
            <SortablePageCard
              node={node}
              isSelected={showSelection ? selectedIds.includes(node.id) : undefined}
              onSelectChange={showSelection ? (checked) => handleSelectRow(node.id, checked) : undefined}
              onEdit={() => onEdit(node)}
              onDelete={() => onDelete(node)}
              onToggleVisibility={() => onToggleVisibility(node.id, !(node.is_active ?? true))}
              onToggleInNav={() => onToggleInNav(node.id, !(node.show_in_navigation ?? true))}
              isVisibilityPending={isVisibilityPending}
              isNavPending={isNavPending}
              renderChildren={
                node.children.length > 0 ? () => renderTree(node.children, depth + 1, node.id) : undefined
              }
            />
          </div>
        ))}
        <SlotDroppable
          id={slotId(parentId, nodes.length)}
          parentId={parentId}
          index={nodes.length}
          depth={depth}
        />
      </div>
    );
  };

  if (pages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
          <LayoutList className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Add a page above to see it here. Sort by Order to use this card view and drag to reorder.
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
            Select all ({allIds.length} pages)
          </span>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
          {renderTree(tree, 0)}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeNode ? <PageCardOverlay node={activeNode} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
