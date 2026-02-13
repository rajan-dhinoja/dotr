import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { getSystemRouteForSlug } from '@/lib/systemRoutes';
import type { TablesInsert } from '@/integrations/supabase/types';

/** Sync pages (show_in_navigation) to menu_items for a given menu location. */
export function useSyncPagesToMenu() {
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (menuLocation: string) => {
      const { data: allPages, error: pagesError } = await supabase
        .from('pages')
        .select('id, title, slug, description, parent_id, is_active, show_in_nav, show_in_navigation, display_order, navigation_label_override')
        .eq('is_active', true)
        .or('show_in_nav.eq.true,show_in_navigation.eq.true')
        .order('display_order');

      if (pagesError) throw pagesError;
      if (!allPages || allPages.length === 0) {
        throw new Error('No pages found to sync. Turn on "In nav" for at least one page.');
      }

      const { data: existingMenuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_location', menuLocation);

      if (menuError) throw menuError;

      // Treat menu items with a section_anchor as manual section links that should
      // not be touched by the sync process.
      const isManualSectionItem = (item: (typeof existingMenuItems)[0]) =>
        (item as any).section_anchor != null;

      // One menu_item per page_id: keep first occurrence so we update it; duplicates
      // (excluding manual section-link items) will be deleted later.
      const pageIdToMenuItem = new Map<string, (typeof existingMenuItems)[0]>();
      existingMenuItems?.forEach((item) => {
        if (
          item.page_id &&
          item.menu_location === menuLocation &&
          !isManualSectionItem(item) &&
          !pageIdToMenuItem.has(item.page_id)
        ) {
          pageIdToMenuItem.set(item.page_id, item);
        }
      });

      const keptMenuItemIds = new Set<string>();

      const pagesByParent = new Map<string | null, (typeof allPages)[0][]>();
      allPages.forEach((page) => {
        const parentId = page.parent_id || null;
        if (!pagesByParent.has(parentId)) pagesByParent.set(parentId, []);
        pagesByParent.get(parentId)!.push(page);
      });

      const getPageUrl = (slug: string): string => getSystemRouteForSlug(slug);

      const syncPageRecursive = async (
        page: (typeof allPages)[0],
        parentMenuItemId: string | null,
        level: number
      ): Promise<string | null> => {
        const existingItem = pageIdToMenuItem.get(page.id);
        const url = getPageUrl(page.slug);
        const hasChildren = (pagesByParent.get(page.id)?.length ?? 0) > 0;
        const menuTypeValue = level === 0 && hasChildren ? 'mega' : 'simple';

        const menuItemData: TablesInsert<'menu_items'> = {
          menu_location: menuLocation,
          label: page.navigation_label_override || page.title,
          url: url || null,
          page_id: page.id,
          parent_id: parentMenuItemId,
          target: '_self',
          is_active: page.is_active ?? true,
          display_order: page.display_order ?? 0,
          menu_type: menuTypeValue,
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
          const { data: updated, error } = await supabase
            .from('menu_items')
            .update(menuItemData)
            .eq('id', existingItem.id)
            .select('id')
            .single();
          if (error) throw error;
          menuItemId = updated?.id ?? existingItem.id;
          keptMenuItemIds.add(menuItemId);
        } else {
          const { data: inserted, error } = await supabase
            .from('menu_items')
            .insert(menuItemData)
            .select('id')
            .single();
          if (error) throw error;
          menuItemId = inserted?.id ?? null;
          if (menuItemId) keptMenuItemIds.add(menuItemId);
        }

        const children = (pagesByParent.get(page.id) ?? []).sort(
          (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
        );
        for (const child of children) {
          await syncPageRecursive(child, menuItemId, level + 1);
        }
        return menuItemId;
      };

      const topLevelPages = (pagesByParent.get(null) ?? []).sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      let syncedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const page of topLevelPages) {
        try {
          await syncPageRecursive(page, null, 0);
          syncedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`"${page.title}": ${msg}`);
        }
      }

      if (errorCount > 0) {
        throw new Error(`Synced ${syncedCount}, failed ${errorCount}:\n${errors.join('\n')}`);
      }

      // Remove duplicate or stale menu_items for this location (keep only synced items)
      const idsToKeep = Array.from(keptMenuItemIds);
      const allIdsForLocation = (existingMenuItems ?? [])
        .filter((m) => m.menu_location === menuLocation && !isManualSectionItem(m))
        .map((m) => m.id);
      const idsToDelete = allIdsForLocation.filter((id) => !keptMenuItemIds.has(id));
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('menu_items')
          .delete()
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }

      return { synced: syncedCount };
    },
    onSuccess: (data, menuLocation) => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = (q.queryKey[0] as string) || '';
          return ['admin-menu-items', 'navigation-menu', 'mega-menu', 'nav-pages'].includes(k);
        },
      });
      toast({
        title: 'Pages synced to menu',
        description: `${data.synced} pages synced to ${menuLocation} menu`,
      });
      logActivity({
        action: 'update',
        entity_type: 'menu_items',
        entity_name: `Synced ${data.synced} pages to ${menuLocation} menu`,
      });
    },
    onError: (e: Error) => {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    },
  });
}
