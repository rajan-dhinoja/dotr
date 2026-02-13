// Navigation hook - uses menu_items table instead of non-existent navigation tables
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MenuItem = Tables<"menu_items">;

export interface NavigationTreeItem extends MenuItem {
  /** Optional anchor for deep-linking to a section on the target page */
  section_anchor?: string | null;
  /** Optional FK to page_sections.id for stronger linkage to a section */
  section_id?: string | null;
  children: NavigationTreeItem[];
}

export function useNavigationMenu(menuLocation: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["navigation-menu", menuLocation],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("menu_items")
        .select(`
          *,
          page:pages(id, slug, title)
        `)
        .eq("menu_location", menuLocation)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      
      if (!items || items.length === 0) {
        return [];
      }

      return buildNavigationTree(items);
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

function buildNavigationTree(items: MenuItem[]): NavigationTreeItem[] {
  const byId = new Map<string, NavigationTreeItem>();

  items.forEach((item) => {
    byId.set(item.id, { ...item, children: [] });
  });

  const roots: NavigationTreeItem[] = [];

  byId.forEach((item) => {
    if (item.parent_id && byId.has(item.parent_id)) {
      const parent = byId.get(item.parent_id)!;
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  });

  const sortRecursive = (nodes: NavigationTreeItem[]) => {
    nodes.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    nodes.forEach((child) => sortRecursive(child.children));
  };

  sortRecursive(roots);

  return roots;
}
