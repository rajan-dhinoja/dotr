import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  parsePagesMenuFile,
  validatePagesMenuImportData,
  exportPagesMenuToFile,
  type PageImportItem,
  type MenuItemFlat,
} from '@/lib/pagesMenuImportExport';
import { getSystemRouteForSlug } from '@/lib/systemRoutes';
import { logJsonImport, logJsonExport } from '@/lib/entityJson/audit';

export type PagesImportMode = 'skip' | 'overwrite' | 'merge';

export interface PagesImportOptions {
  onConflict?: PagesImportMode;
}

export interface PagesImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  overwritten: number;
  failed: number;
  errors: Array<{ pageIndex?: number; menuItemIndex?: number; error: string }>;
}

const QUERY_KEYS = {
  adminPages: ['admin-pages'],
  adminPagesTree: ['admin-pages-tree'],
  adminMenuItems: ['admin-menu-items'],
  pages: ['pages'],
  navPages: ['nav-pages'],
  adminPagesForNav: ['admin-pages-for-nav'],
} as const;

function getPageHref(slug: string): string {
  return getSystemRouteForSlug(slug);
}

function sortPagesTopo(pages: PageImportItem[]): PageImportItem[] {
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const sorted: PageImportItem[] = [];
  const added = new Set<string>();

  let progress = true;
  while (progress && sorted.length < pages.length) {
    progress = false;
    for (const p of pages) {
      if (added.has(p.slug)) continue;
      const parentSlug = p.parent_slug?.trim() || null;
      if (!parentSlug || added.has(parentSlug)) {
        sorted.push(p);
        added.add(p.slug);
        progress = true;
      }
    }
  }
  return sorted;
}

function sortMenuItemsTopo(items: MenuItemFlat[]): MenuItemFlat[] {
  const byLocation = new Map<string, MenuItemFlat[]>();
  for (const it of items) {
    const list = byLocation.get(it.menu_location) ?? [];
    list.push(it);
    byLocation.set(it.menu_location, list);
  }

  const out: MenuItemFlat[] = [];
  for (const list of byLocation.values()) {
    const keyToItem = new Map(list.map((m) => [m.key, m]));
    const added = new Set<string>();
    let progress = true;
    while (progress && added.size < list.length) {
      progress = false;
      for (const it of list) {
        if (added.has(it.key)) continue;
        const pk = it.parent_key?.trim() || null;
        if (!pk || added.has(pk)) {
          out.push(it);
          added.add(it.key);
          progress = true;
        }
      }
    }
  }
  return out;
}

function buildPageUpdate(
  existing: { id: string; [k: string]: unknown },
  p: PageImportItem,
  parentId: string | null,
  mode: 'overwrite' | 'merge'
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: p.title,
    description: p.description ?? null,
    meta_title: p.meta_title ?? null,
    meta_description: p.meta_description ?? null,
    template: p.template ?? 'default',
    parent_id: parentId,
    is_active: p.is_active ?? true,
    show_in_nav: p.show_in_nav ?? true,
    show_in_navigation: p.show_in_navigation ?? true,
    display_order: p.display_order ?? 0,
    content: (p.content as Record<string, unknown>) ?? {},
    source_entity_type: p.source_entity_type ?? null,
    source_entity_id: p.source_entity_id ?? null,
  };
  if (mode === 'overwrite') return payload;
  const out: Record<string, unknown> = {};
  const keys = [
    'title', 'description', 'meta_title', 'meta_description', 'template',
    'parent_id', 'is_active', 'show_in_nav', 'show_in_navigation', 'display_order', 'content',
    'source_entity_type', 'source_entity_id',
  ] as const;
  for (const k of keys) {
    const v = payload[k];
    if (k === 'parent_id' || (v !== undefined && v !== null)) {
      out[k] = payload[k];
    } else if (existing[k] !== undefined) {
      out[k] = existing[k];
    }
  }
  return out;
}

export function usePagesImportExport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const exportPagesMenu = useCallback(async () => {
    try {
      const [pagesRes, menuRes] = await Promise.all([
        supabase.from('pages').select('*').order('display_order'),
        supabase.from('menu_items').select('*').order('display_order'),
      ]);
      if (pagesRes.error) throw pagesRes.error;
      if (menuRes.error) throw menuRes.error;
      const pages = (pagesRes.data ?? []) as Array<{
        id: string;
        slug: string;
        title: string;
        description?: string | null;
        meta_title?: string | null;
        meta_description?: string | null;
        template?: string | null;
        parent_id?: string | null;
        is_active?: boolean | null;
        show_in_nav?: boolean | null;
        display_order?: number | null;
        content?: Record<string, unknown> | null;
      }>;
      const menuItems = (menuRes.data ?? []) as Array<{
        id: string;
        menu_location: string;
        label: string;
        url?: string | null;
        page_id?: string | null;
        parent_id?: string | null;
        display_order?: number | null;
        target?: string | null;
        is_active?: boolean | null;
        menu_type?: string | null;
      }>;
      exportPagesMenuToFile(pages as Parameters<typeof exportPagesMenuToFile>[0], menuItems);
      await logJsonExport('pages_and_menu', pages.length + menuItems.length);
      toast({
        title: 'Export completed',
        description: `${pages.length} pages, ${menuItems.length} menu items exported`,
      });
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Failed to export',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const importPagesMenu = useCallback(
    async (file: File, options: PagesImportOptions = {}): Promise<PagesImportResult> => {
      const onConflict = options.onConflict ?? 'skip';

      try {
        const data = await parsePagesMenuFile(file);
        const validation = validatePagesMenuImportData(data);

        if (!validation.valid) {
          const msg = validation.errors
            .map((e) => {
              if (e.pageIndex != null) return `Page ${e.pageIndex + 1}: ${e.message}`;
              if (e.menuItemIndex != null)
                return `Menu item ${e.menuItemIndex + 1}: ${e.message}`;
              return e.message;
            })
            .join('; ');
          toast({ title: 'Validation failed', description: msg, variant: 'destructive' });
          return {
            success: false,
            total: data.pages.length + data.menu_items.length,
            imported: 0,
            skipped: 0,
            overwritten: 0,
            failed: data.pages.length + data.menu_items.length,
            errors: validation.errors.map((e) => ({
              pageIndex: e.pageIndex,
              menuItemIndex: e.menuItemIndex,
              error: e.message,
            })),
          };
        }

        if (validation.warnings?.length) {
          const msg = validation.warnings
            .map((w) => {
              if (w.pageIndex != null) return `Page ${w.pageIndex + 1}: ${w.message}`;
              if (w.menuItemIndex != null)
                return `Menu item ${w.menuItemIndex + 1}: ${w.message}`;
              return w.message;
            })
            .join('; ');
          toast({ title: 'Import warnings', description: msg });
        }

        const [existingPagesRes, existingMenuRes] = await Promise.all([
          supabase.from('pages').select('id, slug, title, description, meta_title, meta_description, template, parent_id, is_active, show_in_nav, display_order, content'),
          supabase.from('menu_items').select('id, menu_location, label, url, page_id, parent_id, display_order, target, is_active, menu_type'),
        ]);
        if (existingPagesRes.error) throw existingPagesRes.error;
        if (existingMenuRes.error) throw existingMenuRes.error;
        const existingPages = (existingPagesRes.data ?? []) as unknown as Array<{
          id: string;
          slug: string;
          [k: string]: unknown;
        }>;
        const existingMenu = (existingMenuRes.data ?? []) as Array<{
          id: string;
          menu_location: string;
          label: string;
          url: string | null;
          page_id: string | null;
          parent_id: string | null;
          display_order: number;
          target: string | null;
          is_active: boolean | null;
          menu_type: string | null;
        }>;

        const slugToId = new Map<string, string>();
        const menuKeyToId = new Map<string, string>();
        let imported = 0;
        let skipped = 0;
        let overwritten = 0;
        let failed = 0;
        const errors: PagesImportResult['errors'] = [];

        const sortedPages = sortPagesTopo(data.pages);

        for (let i = 0; i < sortedPages.length; i++) {
          const p = sortedPages[i];
          try {
            const existing = existingPages.find((x) => x.slug === p.slug);
            if (existing) {
              if (onConflict === 'skip') {
                slugToId.set(p.slug, existing.id);
                skipped++;
                continue;
              }
              const parentId = p.parent_slug ? slugToId.get(p.parent_slug) ?? null : null;
              const payload = buildPageUpdate(
                existing,
                p,
                parentId,
                onConflict === 'merge' ? 'merge' : 'overwrite'
              );
              const { error } = await supabase
                .from('pages')
                .update(payload)
                .eq('id', existing.id);
              if (error) throw error;
              slugToId.set(p.slug, existing.id);
              overwritten++;
            } else {
              const parentId = p.parent_slug ? slugToId.get(p.parent_slug) ?? null : null;
              const { data: inserted, error } = await supabase
                .from('pages')
                .insert([{
                  slug: p.slug,
                  title: p.title,
                  description: p.description ?? null,
                  meta_title: p.meta_title ?? null,
                  meta_description: p.meta_description ?? null,
                  template: p.template ?? 'default',
                  parent_id: parentId,
                  is_active: p.is_active ?? true,
                  show_in_nav: p.show_in_nav ?? true,
                  show_in_navigation: p.show_in_navigation ?? true,
                  display_order: p.display_order ?? 0,
                  content: ((p.content as Record<string, unknown>) ?? {}) as Json,
                  source_entity_type: p.source_entity_type ?? null,
                  source_entity_id: p.source_entity_id ?? null,
                }])
                .select('id')
                .single();
              if (error) throw error;
              if (inserted?.id) slugToId.set(p.slug, inserted.id);
              imported++;
            }
          } catch (e) {
            failed++;
            errors.push({
              pageIndex: data.pages.indexOf(p),
              error: e instanceof Error ? e.message : 'Unknown error',
            });
          }
        }

        const sortedMenu = sortMenuItemsTopo(data.menu_items);

        function findExistingMenuItem(
          loc: string,
          label: string,
          parentId: string | null
        ): (typeof existingMenu)[0] | undefined {
          return existingMenu.find(
            (m) =>
              m.menu_location === loc &&
              m.label === label &&
              (m.parent_id ?? null) === parentId
          );
        }

        for (let i = 0; i < sortedMenu.length; i++) {
          const it = sortedMenu[i];
          try {
            const parentId = it.parent_key
              ? menuKeyToId.get(`${it.menu_location}:${it.parent_key}`) ?? null
              : null;
            const pageId = it.page_slug ? slugToId.get(it.page_slug) ?? null : null;
            const url = it.url ?? (it.page_slug ? getPageHref(it.page_slug) : null);

            const existing = findExistingMenuItem(it.menu_location, it.label, parentId);

            if (existing) {
              if (onConflict === 'skip') {
                menuKeyToId.set(`${it.menu_location}:${it.key}`, existing.id);
                skipped++;
                continue;
              }
              const payload = {
                label: it.label,
                url,
                page_id: pageId,
                parent_id: parentId,
                display_order: it.display_order,
                target: it.target ?? '_self',
                is_active: it.is_active ?? true,
                ...(it.menu_type !== undefined && { menu_type: it.menu_type ?? null }),
              };
              const { error } = await supabase
                .from('menu_items')
                .update(payload)
                .eq('id', existing.id);
              if (error) throw error;
              menuKeyToId.set(`${it.menu_location}:${it.key}`, existing.id);
              overwritten++;
            } else {
              const { data: inserted, error } = await supabase
                .from('menu_items')
                .insert({
                  menu_location: it.menu_location,
                  label: it.label,
                  url,
                  page_id: pageId,
                  parent_id: parentId,
                  display_order: it.display_order,
                  target: it.target ?? '_self',
                  is_active: it.is_active ?? true,
                  ...(it.menu_type !== undefined && { menu_type: it.menu_type ?? null }),
                })
                .select('id')
                .single();
              if (error) throw error;
              if (inserted?.id) menuKeyToId.set(`${it.menu_location}:${it.key}`, inserted.id);
              imported++;
            }
          } catch (e) {
            failed++;
            errors.push({
              menuItemIndex: data.menu_items.indexOf(it),
              error: e instanceof Error ? e.message : 'Unknown error',
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminPages });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminPagesTree });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminMenuItems });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pages });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.navPages });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminPagesForNav });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'mega-menu' });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'page' });
        // Force refetch of admin pages so the list updates immediately
        await queryClient.refetchQueries({ queryKey: QUERY_KEYS.adminPages });
        await queryClient.refetchQueries({ queryKey: QUERY_KEYS.adminPagesTree });

        await logJsonImport('pages_and_menu', imported + overwritten, failed);

        const total = data.pages.length + data.menu_items.length;
        const hasErrors = failed > 0 || errors.length > 0;
        toast({
          title: 'Import completed',
          description: `${imported} imported, ${overwritten} overwritten, ${skipped} skipped${failed > 0 ? `, ${failed} failed` : ''}`,
          variant: hasErrors ? 'destructive' : 'default',
        });

        return {
          success: !hasErrors,
          total,
          imported,
          skipped,
          overwritten,
          failed,
          errors,
        };
      } catch (e) {
        toast({
          title: 'Import failed',
          description: e instanceof Error ? e.message : 'Failed to import',
          variant: 'destructive',
        });
        return {
          success: false,
          total: 0,
          imported: 0,
          skipped: 0,
          overwritten: 0,
          failed: 0,
          errors: [
            {
              error: e instanceof Error ? e.message : 'Unknown error',
            },
          ],
        };
      }
    },
    [toast, queryClient]
  );

  return { importPagesMenu, exportPagesMenu };
}
