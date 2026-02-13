import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminMenuItemRow {
  id: string;
  label: string;
  menu_location: string;
  url: string | null;
  page_id: string | null;
  parent_id: string | null;
  display_order: number | null;
  is_active: boolean | null;
  menu_type: string | null;
  section_anchor?: string | null;
  section_id?: string | null;
  page?: {
    id: string;
    slug: string;
    title: string;
    source_entity_type?: string | null;
    is_active?: boolean | null;
    show_in_navigation?: boolean | null;
  } | null;
}

export interface AdminMenuItemNode extends AdminMenuItemRow {
  children: AdminMenuItemNode[];
  level: number;
}

function buildMenuTree(items: AdminMenuItemRow[]): AdminMenuItemNode[] {
  const byId = new Map<string, AdminMenuItemNode>();
  items.forEach((item) => {
    byId.set(item.id, { ...item, children: [], level: 0 });
  });
  const roots: AdminMenuItemNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      const parent = byId.get(node.parent_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const assignLevel = (nodes: AdminMenuItemNode[], level: number) => {
    nodes.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    nodes.forEach((n) => {
      n.level = level;
      assignLevel(n.children, level + 1);
    });
  };
  assignLevel(roots, 0);
  return roots;
}

export type MenuItemReorderUpdate = {
  id: string;
  parent_id: string | null;
  display_order: number;
  item_level: number;
};

function flattenMenuTree(nodes: AdminMenuItemNode[]): MenuItemReorderUpdate[] {
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

export function useAdminMenuItems(menuLocation: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-menu-items', menuLocation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select(
          'id, label, menu_location, url, page_id, parent_id, display_order, is_active, menu_type, section_anchor, section_id, page:pages(id, slug, title, source_entity_type, is_active, show_in_navigation)'
        )
        .eq('menu_location', menuLocation)
        .order('display_order', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as AdminMenuItemRow[];
      return { items: rows, tree: buildMenuTree(rows) };
    },
    enabled: !!menuLocation,
    staleTime: 60 * 1000,
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: MenuItemReorderUpdate[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('menu_items')
          .update({
            parent_id: u.parent_id,
            display_order: u.display_order,
            item_level: u.item_level,
          })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, __, context: { menuLocation: string }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items', context.menuLocation] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
    },
  });

  return {
    ...query,
    reorderMutation,
    flattenTree: flattenMenuTree,
    buildTree: buildMenuTree,
  };
}
