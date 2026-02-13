import { Pencil, Trash2, GripVertical } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ColumnHeader } from './ColumnHeader';
import type { AdminColumn, BaseEntity, SortConfig } from '@/lib/types/admin';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTableRow<T extends BaseEntity>({
  item,
  children,
  isSelected,
  onSelectChange,
  columns,
  onEdit,
  onDelete,
  actions,
}: {
  item: T;
  children?: React.ReactNode;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  columns: AdminColumn<T>[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={isSelected ? 'selected' : undefined}
    >
      <TableCell className="w-10 p-1">
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none rounded p-1 -m-1 inline-flex"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelectChange}
          aria-label={`Select ${item.id}`}
        />
      </TableCell>
      {columns.map((col) => (
        <TableCell key={String(col.key)} style={{ width: col.width }}>
          {col.render ? col.render(item) : String(item[col.key as keyof T] ?? '')}
        </TableCell>
      ))}
      {(onEdit || onDelete || actions) && (
        <TableCell>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {actions && actions(item)}
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(item)} aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

interface AdminDataTableProps<T extends BaseEntity> {
  data: T[];
  columns: AdminColumn<T>[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  sortConfig?: SortConfig | null;
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  /** When true, rows can be reordered by drag; requires onReorder. */
  reorderable?: boolean;
  /** Called with the new order of items (for current page) after a drag. */
  onReorder?: (reorderedItems: T[]) => void;
}

export function AdminDataTable<T extends BaseEntity>({
  data,
  columns,
  selectedIds,
  onSelectionChange,
  sortConfig,
  onSortChange,
  loading = false,
  onEdit,
  onDelete,
  actions,
  emptyMessage = 'No data found',
  reorderable = false,
  onReorder,
}: AdminDataTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;
  const canReorder = reorderable && !!onReorder && data.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(data.map((item) => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const handleSort = (field: string) => {
    if (!onSortChange) return;

    const currentField = sortConfig?.field;
    const currentDirection = sortConfig?.direction;

    if (currentField === field) {
      // Toggle direction
      onSortChange(field, currentDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to asc
      onSortChange(field, 'asc');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = data.findIndex((d) => d.id === active.id);
    const newIndex = data.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const reordered = arrayMove(data, oldIndex, newIndex);
    onReorder?.(reordered);
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={String(col.key)}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
              {(onEdit || onDelete || actions) && (
                <TableHead className="w-24">
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={String(col.key)}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
                {(onEdit || onDelete || actions) && <TableCell />}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {canReorder && (
              <TableHead className="w-10 p-1" aria-label="Reorder" />
            )}
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            {columns.map((col) => (
              <TableHead key={String(col.key)} style={{ width: col.width }}>
                <ColumnHeader
                  label={col.label}
                  sortable={col.sortable && !!onSortChange}
                  sortConfig={sortConfig}
                  field={String(col.key)}
                  onSort={handleSort}
                />
              </TableHead>
            ))}
            {(onEdit || onDelete || actions) && (
              <TableHead className="w-24">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        {canReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={data.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <TableBody>
                {data.map((item) => (
                  <SortableTableRow
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.includes(item.id)}
                    onSelectChange={(checked) => handleSelectRow(item.id, checked)}
                    columns={columns}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    actions={actions}
                  />
                ))}
              </TableBody>
            </SortableContext>
          </DndContext>
        ) : (
          <TableBody>
            {data.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <TableRow key={item.id} data-state={isSelected ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
                      aria-label={`Select ${item.id}`}
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} style={{ width: col.width }}>
                      {col.render ? col.render(item) : String(item[col.key as keyof T] ?? '')}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete || actions) && (
                    <TableCell>
                      <div className="flex gap-2">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(item)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {actions && actions(item)}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(item)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </Table>
    </div>
  );
}
