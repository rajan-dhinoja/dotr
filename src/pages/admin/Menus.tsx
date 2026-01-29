import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { IconPicker } from "@/components/admin/IconPicker";
import { resolveIcon } from "@/lib/menuUtils";
import {
  Plus,
  GripVertical,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// MenuItem type now includes mega menu columns from database
type MenuItem = Tables<"menu_items">;

interface Page {
  id: string;
  title: string;
  slug: string;
  is_active: boolean | null;
}

interface TreeNode extends MenuItem {
  children?: TreeNode[];
}

const MENU_LOCATIONS = [
  { value: "header", label: "Header Navigation" },
  { value: "mobile", label: "Mobile Navigation" },
  { value: "footer", label: "Footer Links" },
];

interface SortableMenuItemProps {
  item: TreeNode;
  depth: number;
  renderChildren?: () => React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  getLevelLabel: (n: number | null | undefined) => string;
  getLevelColor: (n: number | null | undefined) => string;
}

function SortableMenuItem({
  item,
  depth,
  renderChildren,
  onEdit,
  onDelete,
  onToggleVisibility,
  getLevelLabel,
  getLevelColor,
}: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const Icon = item.icon_name ? resolveIcon(item.icon_name) : null;
  const level = item.item_level ?? 0;
  const isMega = item.menu_type === "mega";

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
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <p className="font-medium truncate">{item.label}</p>
            <Badge variant="outline" className={cn("text-xs", getLevelColor(level))}>
              {getLevelLabel(level)}
            </Badge>
            {isMega && (
              <Badge variant="secondary" className="text-xs">
                Mega
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground/70 mt-0.5">{item.url || "No link"}</p>
        </div>
        <div className="flex items-center gap-2">
          {item.target === "_blank" && (
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          )}
          <Button variant="ghost" size="icon" onClick={onToggleVisibility}>
            {item.is_active ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4 text-foreground/60" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
      {renderChildren != null && <div className="pb-2">{renderChildren()}</div>}
    </Card>
  );
}

/** Simple card for DragOverlay (no sortable hook, no buttons) */
function MenuCardOverlay({
  item,
  getLevelLabel,
  getLevelColor,
}: {
  item: MenuItem | undefined;
  getLevelLabel: (n: number | null | undefined) => string;
  getLevelColor: (n: number | null | undefined) => string;
}) {
  if (!item) return null;
  const Icon = item.icon_name ? resolveIcon(item.icon_name) : null;
  const level = item.item_level ?? 0;
  const isMega = item.menu_type === "mega";
  return (
    <Card className="shadow-lg ring-2 ring-primary/20">
      <CardContent className="p-3 flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-foreground/60" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <p className="font-medium truncate">{item.label}</p>
            <Badge variant="outline" className={cn("text-xs", getLevelColor(level))}>
              {getLevelLabel(level)}
            </Badge>
            {isMega && (
              <Badge variant="secondary" className="text-xs">
                Mega
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground/70 mt-0.5">{item.url || "No link"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminMenus() {
  const [activeLocation, setActiveLocation] = useState<string>("header");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isItemActive, setIsItemActive] = useState(true);
  const [menuType, setMenuType] = useState<string>("simple");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [itemLevel, setItemLevel] = useState<number>(0);
  const [iconName, setIconName] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();

  const { data: pages = [] } = useQuery({
    queryKey: ["admin-pages-for-nav"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, slug, is_active")
        .order("title");

      if (error) throw error;
      return data as Page[];
    },
  });

  const { data: flatItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["admin-menu-items", activeLocation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("menu_location", activeLocation)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

  const buildTree = (items: MenuItem[]): TreeNode[] => {
    const byId = new Map<string, TreeNode>();
    items.forEach((item) => {
      byId.set(item.id, { ...item, children: [] });
    });
    const roots: TreeNode[] = [];
    byId.forEach((item) => {
      if (item.parent_id && byId.has(item.parent_id)) {
        byId.get(item.parent_id)!.children!.push(item);
      } else {
        roots.push(item);
      }
    });
    const sortRecursive = (nodes: TreeNode[]) => {
      nodes.sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      nodes.forEach((n) => sortRecursive(n.children ?? []));
    };
    sortRecursive(roots);
    return roots;
  };

  const itemsTree = buildTree(flatItems);

  // Calculate item level based on parent selection
  useEffect(() => {
    if (!selectedParentId) {
      setItemLevel(0);
    } else {
      const parent = flatItems.find(item => item.id === selectedParentId);
      if (parent) {
        const parentLevel = parent.item_level ?? 0;
        setItemLevel(parentLevel + 1);
      } else {
        setItemLevel(0);
      }
    }
  }, [selectedParentId, flatItems]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isItemDialogOpen && editingItem) {
      setMenuType(editingItem.menu_type ?? "simple");
      setSelectedParentId(editingItem.parent_id ?? null);
      setItemLevel(editingItem.item_level ?? 0);
      setIconName(editingItem.icon_name ?? null);
      setIsItemActive(editingItem.is_active ?? true);
    } else if (!isItemDialogOpen) {
      setMenuType("simple");
      setSelectedParentId(null);
      setItemLevel(0);
      setIconName(null);
      setIsItemActive(true);
      setEditingItem(null);
    }
  }, [isItemDialogOpen, editingItem]);

  const itemSaveMutation = useMutation({
    mutationFn: async (payload: Partial<MenuItem>) => {
      if (editingItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const insert: TablesInsert<"menu_items"> = {
          menu_location: activeLocation,
          label: payload.label!,
          url: payload.url ?? null,
          page_id: payload.page_id ?? null,
          parent_id: payload.parent_id ?? null,
          target: payload.target ?? "_self",
          is_active: payload.is_active ?? true,
          display_order: payload.display_order ?? 0,
        };

        const { error } = await supabase
          .from("menu_items")
          .insert(insert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-menu-items"],
      });
      logActivity({
        action: editingItem ? "update" : "create",
        entity_type: "menu_item",
        entity_id: editingItem?.id,
        entity_name: editingItem?.label,
      });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      toast({
        title: editingItem ? "Menu item updated" : "Menu item created",
      });
    },
    onError: (e: Error) =>
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      }),
  });

  const itemDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-menu-items"],
      });
      toast({ title: "Menu item deleted" });
    },
  });

  const itemToggleVisibilityMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-menu-items"],
      });
    },
  });

  const syncPagesToMenuMutation = useMutation({
    mutationFn: async (menuLocation: string) => {
      // Fetch all active pages that should be in navigation with all required fields
      const { data: allPages, error: pagesError } = await supabase
        .from("pages")
        .select("id, title, slug, description, parent_id, is_active, show_in_nav, display_order, navigation_label_override")
        .eq("is_active", true)
        .eq("show_in_nav", true)
        .order("display_order");

      if (pagesError) throw pagesError;
      if (!allPages || allPages.length === 0) {
        throw new Error("No pages found to sync");
      }

      // Get existing menu items for this location
      const { data: existingMenuItems, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("menu_location", menuLocation);

      if (menuError) throw menuError;

      // Create a map of page_id to existing menu item (only for this location)
      const pageIdToMenuItem = new Map<string, typeof existingMenuItems[0]>();
      existingMenuItems?.forEach((item) => {
        if (item.page_id && item.menu_location === menuLocation) {
          pageIdToMenuItem.set(item.page_id, item);
        }
      });

      // Build page hierarchy
      const pagesByParent = new Map<string | null, Array<typeof allPages[0]>>();
      const pageIdMap = new Map<string, typeof allPages[0]>();
      
      allPages.forEach((page) => {
        pageIdMap.set(page.id, page);
        const parentId = page.parent_id || null;
        if (!pagesByParent.has(parentId)) {
          pagesByParent.set(parentId, []);
        }
        pagesByParent.get(parentId)!.push(page);
      });

      // Helper to get page URL
      const getPageUrl = (slug: string): string => {
        const systemRoutes: Record<string, string> = {
          'home': '/',
          'about': '/about',
          'services': '/services',
          'portfolio': '/portfolio',
          'blog': '/blog',
          'contact': '/contact',
          'testimonials': '/testimonials',
          'privacy-policy': '/privacy-policy',
          'terms-of-service': '/terms-of-service',
        };
        return systemRoutes[slug] || `/${slug}`;
      };

      // Recursive function to sync pages and their children
      const syncPageRecursive = async (
        page: typeof allPages[0],
        parentMenuItemId: string | null,
        level: number
      ): Promise<string | null> => {
        const existingItem = pageIdToMenuItem.get(page.id);
        const url = getPageUrl(page.slug);
        
        // Determine menu type: mega for top-level items with children, simple otherwise
        const hasChildren = pagesByParent.get(page.id)?.length > 0;
        const menuType = level === 0 && hasChildren ? "mega" : "simple";

        const menuItemData: TablesInsert<"menu_items"> = {
          menu_location: menuLocation,
          label: page.navigation_label_override || page.title,
          url: url || null,
          page_id: page.id,
          parent_id: parentMenuItemId,
          target: "_self",
          is_active: page.is_active ?? true,
          display_order: page.display_order ?? 0,
          menu_type: menuType,
          item_level: level,
          description: page.description || null,
          icon_name: null,
          mega_summary_title: level === 0 && hasChildren ? (page.navigation_label_override || page.title) : null,
          mega_summary_text: level === 0 && hasChildren ? (page.description || '') : null,
          mega_cta_label: null,
          mega_cta_href: null,
        };

        let menuItemId: string | null = null;

        if (existingItem) {
          // Update existing menu item - use Partial for update
          const updateData: Partial<TablesInsert<"menu_items">> = {
            ...menuItemData,
          };
          const { data: updated, error } = await supabase
            .from("menu_items")
            .update(updateData)
            .eq("id", existingItem.id)
            .select("id")
            .single();
          
          if (error) {
            console.error('Error updating menu item:', error);
            throw error;
          }
          menuItemId = updated?.id || existingItem.id;
        } else {
          // Create new menu item
          const { data: inserted, error } = await supabase
            .from("menu_items")
            .insert(menuItemData)
            .select("id")
            .single();
          
          if (error) {
            console.error('Error inserting menu item:', error);
            throw error;
          }
          menuItemId = inserted?.id || null;
        }

        // Sync children
        const children = pagesByParent.get(page.id) || [];
        for (const child of children) {
          await syncPageRecursive(child, menuItemId, level + 1);
        }

        return menuItemId;
      };

      // Sync all top-level pages (no parent)
      const topLevelPages = pagesByParent.get(null) || [];
      let syncedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const page of topLevelPages) {
        try {
          await syncPageRecursive(page, null, 0);
          syncedCount++;
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to sync "${page.title}": ${errorMsg}`);
          console.error(`Error syncing page ${page.title}:`, error);
        }
      }

      if (errorCount > 0) {
        throw new Error(`Synced ${syncedCount} pages, but ${errorCount} failed:\n${errors.join('\n')}`);
      }

      return { synced: syncedCount };
    },
    onSuccess: (data, menuLocation) => {
      // Invalidate all menu-related queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === "admin-menu-items" || 
                 key === "navigation-menu" || 
                 key === "mega-menu" ||
                 key === "nav-pages";
        },
      });
      toast({
        title: "Pages synced to menu",
        description: `${data.synced} pages synced successfully to ${menuLocation} menu`,
      });
      logActivity({
        action: "update",
        entity_type: "menu_items",
        entity_name: `Synced ${data.synced} pages to ${menuLocation} menu`,
      });
    },
    onError: (e: Error) =>
      toast({
        title: "Sync failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const handleItemSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const label = form.get("label")?.toString() ?? "";
    if (!label) {
      toast({
        title: "Validation Error",
        description: "Label is required",
        variant: "destructive",
      });
      return;
    }

    const linkType = form.get("link_type")?.toString() ?? "page";
    const pageIdRaw = form.get("page_id")?.toString();
    const pageId = pageIdRaw && pageIdRaw !== "none" ? pageIdRaw : null;
    const externalUrl = form.get("url")?.toString() || null;

    // Allow menu items without links (for parent items or placeholders)
    // Only validate if a specific link type is selected
    if (linkType === "page" && !pageId && !editingItem) {
      // For new items, if page type is selected but no page chosen, allow it (will be null)
      // This allows creating parent menu items without links
    }

    if (linkType === "external" && !externalUrl && !editingItem) {
      // For new items, if external type is selected but no URL, allow it (will be null)
      // This allows creating parent menu items without links
    }

    // Get the URL based on link type
    let url: string | null = null;
    if (linkType === "page" && pageId) {
      const page = pages.find((p) => p.id === pageId);
      url = page ? `/${page.slug}` : null;
    } else if (linkType === "external") {
      url = externalUrl;
    }

    const parentIdRaw = form.get("parent_id")?.toString();
    const parentId = parentIdRaw && parentIdRaw !== "none" ? parentIdRaw : null;
    const currentMenuType = form.get("menu_type")?.toString() ?? "simple";
    
    // Calculate item level
    let calculatedLevel = 0;
    if (parentId) {
      const parent = flatItems.find(item => item.id === parentId);
      if (parent) {
        calculatedLevel = (parent.item_level ?? 0) + 1;
      }
    }

    const payload: Partial<MenuItem> = {
      label,
      url,
      page_id: linkType === "page" ? pageId : null,
      target: form.get("target")?.toString() ?? "_self",
      is_active: isItemActive,
      display_order: Number(form.get("display_order")) || 0,
      parent_id: parentId,
      menu_type: currentMenuType,
      item_level: calculatedLevel,
      description: form.get("description")?.toString() || null,
      icon_name: form.get("icon_name")?.toString() || null,
      mega_summary_title: form.get("mega_summary_title")?.toString() || null,
      mega_summary_text: form.get("mega_summary_text")?.toString() || null,
      mega_cta_label: form.get("mega_cta_label")?.toString() || null,
      mega_cta_href: form.get("mega_cta_href")?.toString() || null,
    };

    itemSaveMutation.mutate(payload);
  };

  const getLevelLabel = (level: number | null | undefined) => {
    switch (level) {
      case 0: return "Top";
      case 1: return "Category";
      case 2: return "Item";
      default: return "Unknown";
    }
  };

  const getLevelColor = (level: number | null | undefined) => {
    switch (level) {
      case 0: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case 1: return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case 2: return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const [activeId, setActiveId] = useState<string | null>(null);

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const results = await Promise.all(
        items.map(({ id, display_order }) =>
          supabase.from("menu_items").update({ display_order }).eq("id", id)
        )
      );
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === "navigation-menu" || (q.queryKey[0] as string) === "mega-menu" });
      toast({ title: "Order updated" });
      logActivity({ action: "update", entity_type: "menu_items", entity_name: `Reordered items in ${activeLocation}` });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to reorder", description: e.message, variant: "destructive" }),
  });

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

    const activeItem = flatItems.find((i) => i.id === active.id);
    const overItem = flatItems.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;

    const activeParent = activeItem.parent_id ?? null;
    const overParent = overItem.parent_id ?? null;
    if (activeParent !== overParent) return; // only reorder within same level

    const siblings = flatItems
      .filter((i) => (i.parent_id ?? null) === activeParent)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    const oldIndex = siblings.findIndex((s) => s.id === active.id);
    const newIndex = siblings.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map((it, i) => ({ id: it.id, display_order: i })));
  };

  const renderTree = (nodes: TreeNode[], depth = 0) => {
    const ids = nodes.map((n) => n.id);
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={depth === 0 ? "space-y-2" : "space-y-1 pl-6"}>
          {nodes.map((item) => (
            <SortableMenuItem
              key={item.id}
              item={item}
              depth={depth}
              renderChildren={
                item.children && item.children.length > 0
                  ? () => renderTree(item.children!, depth + 1)
                  : undefined
              }
              onEdit={() => {
                setEditingItem(item);
                setIsItemActive(item.is_active ?? true);
                setMenuType(item.menu_type ?? "simple");
                setSelectedParentId(item.parent_id ?? null);
                setIconName(item.icon_name ?? null);
                setIsItemDialogOpen(true);
              }}
              onDelete={() => itemDeleteMutation.mutate(item.id)}
              onToggleVisibility={() =>
                itemToggleVisibilityMutation.mutate({
                  id: item.id,
                  is_active: !item.is_active,
                })
              }
              getLevelLabel={getLevelLabel}
              getLevelColor={getLevelColor}
            />
          ))}
        </div>
      </SortableContext>
    );
  };

  // Determine default link type for editing
  const getDefaultLinkType = () => {
    if (!editingItem) return "page";
    if (editingItem.page_id) return "page";
    if (editingItem.url && editingItem.url.startsWith("http")) return "external";
    return "page";
  };

  return (
    <AdminLayout>
      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Navigation & Menus</h1>
            <p className="text-muted-foreground">
              Configure header, footer, and mobile navigation.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setIsItemActive(true);
              setIsItemDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Menu Item
          </Button>
        </div>
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border">
          <RefreshCw className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sync Pages to Menu</p>
            <p className="text-xs text-muted-foreground">
              Automatically create menu items from all pages marked for navigation
            </p>
          </div>
          <Button
            variant="default"
            onClick={() => {
              console.log('Syncing pages to menu for location:', activeLocation);
              syncPagesToMenuMutation.mutate(activeLocation, {
                onError: (error) => {
                  console.error('Sync error:', error);
                },
                onSuccess: (data) => {
                  console.log('Sync success:', data);
                },
              });
            }}
            disabled={syncPagesToMenuMutation.isPending}
          >
            <RefreshCw className={cn(
              "h-4 w-4 mr-2",
              syncPagesToMenuMutation.isPending && "animate-spin"
            )} />
            {syncPagesToMenuMutation.isPending ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      <Tabs value={activeLocation} onValueChange={setActiveLocation}>
        <TabsList className="mb-4">
          {MENU_LOCATIONS.map((loc) => (
            <TabsTrigger key={loc.value} value={loc.value}>
              {loc.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {MENU_LOCATIONS.map((loc) => (
          <TabsContent key={loc.value} value={loc.value}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{loc.label}</CardTitle>
                  {loc.value === "header" && (
                    <p className="text-xs text-muted-foreground">
                      Use "Sync Pages to Menu" to automatically add pages from the Pages section
                    </p>
                  )}
                  {loc.value === "mobile" && (
                    <p className="text-xs text-muted-foreground">
                      When empty, the Header Navigation is used on mobile. Add items here to customize the mobile menu.
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : itemsTree.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      No menu items yet. Add one to get started.
                    </p>
                    {loc.value === "header" && (
                      <p className="text-xs text-muted-foreground">
                        Tip: Click "Sync Pages to Menu" to automatically create menu items from your imported pages.
                      </p>
                    )}
                    {loc.value === "mobile" && (
                      <p className="text-xs text-muted-foreground">
                        When empty, mobile devices show the Header Navigation. Add items here to customize the mobile menu, or sync from pages.
                      </p>
                    )}
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                  >
                    {renderTree(itemsTree)}
                    <DragOverlay dropAnimation={null}>
                      {activeId ? (
                        <MenuCardOverlay
                          item={flatItems.find((i) => i.id === activeId)}
                          getLevelLabel={getLevelLabel}
                          getLevelColor={getLevelColor}
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? "Update the menu item details below. Changes will be reflected in the navigation menu."
                : "Create a new menu item for your navigation. You can link it to a page or external URL, or leave it as a parent item."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleItemSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 overflow-y-auto flex-1 px-6 pb-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                name="label"
                defaultValue={editingItem?.label ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="menu_type">Menu Type</Label>
              <Select 
                name="menu_type" 
                value={menuType}
                onValueChange={setMenuType}
                disabled={itemLevel !== 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select menu type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple Link</SelectItem>
                  <SelectItem value="mega" disabled={itemLevel !== 0}>
                    Mega Menu {itemLevel !== 0 && "(Top-level only)"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {itemLevel !== 0 && (
                <p className="text-xs text-muted-foreground">
                  Mega menus can only be set for top-level items (level 0)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_type">Link Type</Label>
              <Select name="link_type" defaultValue={getDefaultLinkType()}>
                <SelectTrigger>
                  <SelectValue placeholder="Select link type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">Internal Page</SelectItem>
                  <SelectItem value="external">External URL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page_id">Page (if internal) - Optional</Label>
              <Select name="page_id" defaultValue={editingItem?.page_id || "none"} key={`page-${editingItem?.id || "new"}`}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a page (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (no link)</SelectItem>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave empty to create a menu item without a link (useful for parent items)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">External URL (if external) - Optional</Label>
              <Input
                id="url"
                name="url"
                placeholder="https://..."
                defaultValue={
                  editingItem?.url?.startsWith("http")
                    ? editingItem.url
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to create a menu item without a link (useful for parent items)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_id">Parent Item (optional)</Label>
              <Select
                name="parent_id"
                value={selectedParentId ?? "none"}
                onValueChange={(value) => setSelectedParentId(value === "none" ? null : value)}
                key={`parent-${editingItem?.id || "new"}-${selectedParentId || "none"}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {flatItems
                    .filter((item) => item.id !== editingItem?.id)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label} (Level {item.item_level ?? 0})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Current level: {itemLevel} ({getLevelLabel(itemLevel)})
              </p>
            </div>

            {/* Description field - shown for level 1 and 2 items */}
            {(itemLevel === 1 || itemLevel === 2) && (
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description {itemLevel === 1 ? "(Category description)" : "(Item description)"}
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingItem?.description ?? ""}
                  placeholder={itemLevel === 1 ? "Describe this category..." : "Describe this item..."}
                />
              </div>
            )}

            {/* Icon picker - shown for all levels */}
            <div className="space-y-2">
              <Label>Icon (Optional)</Label>
              <IconPicker
                value={iconName}
                onValueChange={setIconName}
                placeholder="Select an icon..."
              />
              <input
                type="hidden"
                id="icon_name"
                name="icon_name"
                value={iconName ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Icons are displayed in the navigation menu and help users identify menu items quickly
              </p>
            </div>

            {/* Mega menu fields - shown only for level 0 items with menu_type='mega' */}
            {itemLevel === 0 && menuType === "mega" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mega_summary_title">Mega Menu Summary Title</Label>
                  <Input
                    id="mega_summary_title"
                    name="mega_summary_title"
                    defaultValue={editingItem?.mega_summary_title ?? ""}
                    placeholder="e.g., Services"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mega_summary_text">Mega Menu Summary Text</Label>
                  <Textarea
                    id="mega_summary_text"
                    name="mega_summary_text"
                    defaultValue={editingItem?.mega_summary_text ?? ""}
                    placeholder="Describe what this section offers..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mega_cta_label">Call-to-Action Label</Label>
                  <Input
                    id="mega_cta_label"
                    name="mega_cta_label"
                    defaultValue={editingItem?.mega_cta_label ?? ""}
                    placeholder="e.g., Explore More"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mega_cta_href">Call-to-Action Link</Label>
                  <Input
                    id="mega_cta_href"
                    name="mega_cta_href"
                    defaultValue={editingItem?.mega_cta_href ?? ""}
                    placeholder="/services"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="target">Open in</Label>
              <Select
                name="target"
                defaultValue={editingItem?.target ?? "_self"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_self">Same window</SelectItem>
                  <SelectItem value="_blank">New tab</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                name="display_order"
                type="number"
                defaultValue={editingItem?.display_order ?? 0}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={isItemActive}
                onCheckedChange={setIsItemActive}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsItemDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={itemSaveMutation.isPending}>
                {editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
