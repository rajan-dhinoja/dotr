import type { Json } from '@/integrations/supabase/types';

/**
 * Page item for import/export (slug-based, no id on import)
 */
export interface PageImportItem {
  slug: string;
  title: string;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  template?: string | null;
  parent_slug?: string | null;
  is_active?: boolean;
  show_in_nav?: boolean;
  show_in_navigation?: boolean;
  display_order?: number;
  content?: Record<string, unknown> | null;
  /** Page type for admin display: manual, about, contact, blog, portfolio, testimonials, service_category, service */
  source_entity_type?: string | null;
  /** UUID of linked entity (service_categories.id or services.id). Null for semantic types. */
  source_entity_id?: string | null;
}

/**
 * Menu item for import — flat with parent_key, or nested with children
 */
export interface MenuItemImportFlat {
  key: string;
  menu_location: string;
  label: string;
  url?: string | null;
  page_slug?: string | null;
  parent_key?: string | null;
  display_order?: number;
  target?: string | null;
  is_active?: boolean;
  menu_type?: string | null;
}

export interface MenuItemImportNested extends Omit<MenuItemImportFlat, 'parent_key'> {
  children?: MenuItemImportNested[];
}

export type MenuItemImport = MenuItemImportFlat | MenuItemImportNested;

/**
 * Normalized flat menu item after parse (always has parent_key)
 */
export interface MenuItemFlat {
  key: string;
  menu_location: string;
  label: string;
  url: string | null;
  page_slug: string | null;
  parent_key: string | null;
  display_order: number;
  target: string;
  is_active: boolean;
  menu_type?: string | null;
}

/**
 * Export file shape
 */
export interface PagesMenuExportData {
  version: string;
  entity_type: 'pages_and_menu';
  exported_at: string;
  menu_locations?: string[];
  pages: PageImportItem[];
  menu_items: MenuItemFlat[];
}

/**
 * Validation result for pages/menu import
 */
export interface PagesMenuValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    pageIndex?: number;
    menuItemIndex?: number;
  }>;
  warnings?: Array<{
    path: string;
    message: string;
    pageIndex?: number;
    menuItemIndex?: number;
  }>;
}

function isNested(item: MenuItemImport): item is MenuItemImportNested {
  return 'children' in item && Array.isArray((item as MenuItemImportNested).children);
}

function hasNestedChildren(items: MenuItemImport[]): boolean {
  return items.some((it) => isNested(it) && (it as MenuItemImportNested).children?.length);
}

/**
 * Flatten nested menu items to flat list with parent_key and display_order from depth-first order
 */
function flattenMenuItems(
  items: MenuItemImport[],
  menuLocation: string,
  parentKey: string | null,
  startOrder: number
): { flat: MenuItemFlat[]; nextOrder: number } {
  const flat: MenuItemFlat[] = [];
  let order = startOrder;

  for (const it of items) {
    const key = it.key;
    const base: Omit<MenuItemFlat, 'parent_key' | 'display_order'> = {
      key,
      menu_location: it.menu_location ?? menuLocation,
      label: it.label,
      url: it.url ?? null,
      page_slug: it.page_slug ?? null,
      target: it.target ?? '_self',
      is_active: it.is_active ?? true,
      menu_type: (it as MenuItemImportFlat).menu_type ?? null,
    };

    if (isNested(it) && it.children && it.children.length > 0) {
      flat.push({
        ...base,
        parent_key: parentKey,
        display_order: order++,
      });
      const { flat: childFlat, nextOrder } = flattenMenuItems(
        it.children,
        base.menu_location,
        key,
        order
      );
      flat.push(...childFlat);
      order = nextOrder;
    } else {
      flat.push({
        ...base,
        parent_key: parentKey,
        display_order: it.display_order ?? order++,
      });
    }
  }

  return { flat, nextOrder: order };
}

/**
 * Normalize flat menu items (each has parent_key) to MenuItemFlat[]
 */
function normalizeFlatMenuItems(
  items: MenuItemImportFlat[],
  defaultLocation: string
): MenuItemFlat[] {
  return items.map((it, i) => ({
    key: it.key,
    menu_location: it.menu_location || defaultLocation,
    label: it.label,
    url: it.url ?? null,
    page_slug: it.page_slug ?? null,
    parent_key: it.parent_key?.trim() || null,
    display_order: typeof it.display_order === 'number' ? it.display_order : i,
    target: it.target ?? '_self',
    is_active: it.is_active ?? true,
    menu_type: it.menu_type ?? null,
  }));
}

/**
 * Parse and normalize raw JSON into PagesMenuExportData.
 * Supports both flat menu_items (with parent_key) and nested (with children).
 */
function normalizeParsed(parsed: {
  version?: string;
  entity_type?: string;
  exported_at?: string;
  menu_locations?: string[];
  pages?: unknown;
  menu_items?: unknown;
}): PagesMenuExportData {
  const pages: PageImportItem[] = Array.isArray(parsed.pages)
    ? parsed.pages.map((p) => {
        const x = p as Record<string, unknown>;
        return {
          slug: String(x.slug ?? ''),
          title: String(x.title ?? ''),
          description: (x.description as string) ?? null,
          meta_title: (x.meta_title as string) ?? null,
          meta_description: (x.meta_description as string) ?? null,
          template: (x.template as string) ?? 'default',
          parent_slug: (x.parent_slug as string) ?? null,
          is_active: x.is_active !== false,
          show_in_nav: x.show_in_nav !== false,
          show_in_navigation: x.show_in_navigation !== false,
          display_order: typeof x.display_order === 'number' ? x.display_order : 0,
          content: (x.content as Record<string, unknown>) ?? null,
          source_entity_type: typeof x.source_entity_type === 'string' ? x.source_entity_type : null,
          source_entity_id: typeof x.source_entity_id === 'string' ? x.source_entity_id : null,
        };
      })
    : [];

  const rawMenu = Array.isArray(parsed.menu_items) ? (parsed.menu_items as MenuItemImport[]) : [];
  const defaultLocation = parsed.menu_locations?.[0] ?? 'header';

  const menuItems: MenuItemFlat[] = hasNestedChildren(rawMenu)
    ? flattenMenuItems(rawMenu, defaultLocation, null, 0).flat
    : normalizeFlatMenuItems(rawMenu as MenuItemImportFlat[], defaultLocation);

  return {
    version: String(parsed.version ?? '1.0'),
    entity_type: 'pages_and_menu',
    exported_at: String(parsed.exported_at ?? new Date().toISOString()),
    menu_locations: Array.isArray(parsed.menu_locations) ? parsed.menu_locations : [],
    pages,
    menu_items: menuItems,
  };
}

/**
 * Parse pages/menu import file
 */
export function parsePagesMenuFile(file: File): Promise<PagesMenuExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (!parsed.version || !parsed.entity_type) {
          reject(new Error('Invalid import file format. Expected version and entity_type.'));
          return;
        }
        if (parsed.entity_type !== 'pages_and_menu') {
          reject(new Error('Invalid entity type. Expected pages_and_menu.'));
          return;
        }
        if (!Array.isArray(parsed.pages)) {
          reject(new Error('Missing or invalid pages array.'));
          return;
        }
        if (!Array.isArray(parsed.menu_items)) {
          reject(new Error('Missing or invalid menu_items array.'));
          return;
        }
        resolve(normalizeParsed(parsed as Parameters<typeof normalizeParsed>[0]));
      } catch (err) {
        reject(
          new Error(`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`)
        );
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Check for cycles in parent_slug references (pages)
 */
function pageCycleCheck(pages: PageImportItem[]): number | null {
  const slugToIndex = new Map<string, number>();
  pages.forEach((p, i) => slugToIndex.set(p.slug, i));
  const visited = new Set<number>();
  const stack = new Set<number>();

  function visit(i: number): boolean {
    if (stack.has(i)) return true;
    if (visited.has(i)) return false;
    visited.add(i);
    stack.add(i);
    const p = pages[i];
    const parentSlug = p.parent_slug?.trim() || null;
    if (parentSlug) {
      const parentIdx = slugToIndex.get(parentSlug);
      if (parentIdx !== undefined && visit(parentIdx)) {
        stack.delete(i);
        return true;
      }
    }
    stack.delete(i);
    return false;
  }

  for (let i = 0; i < pages.length; i++) {
    if (visit(i)) return i;
  }
  return null;
}

/**
 * Check for cycles in parent_key references (menu items, per menu_location)
 */
function menuCycleCheck(items: MenuItemFlat[]): number | null {
  const byLocation = new Map<string, MenuItemFlat[]>();
  for (const it of items) {
    const list = byLocation.get(it.menu_location) ?? [];
    list.push(it);
    byLocation.set(it.menu_location, list);
  }

  for (const list of byLocation.values()) {
    const keyToIndex = new Map<string, number>();
    list.forEach((it, i) => keyToIndex.set(it.key, i));
    const visited = new Set<number>();
    const stack = new Set<number>();

    function visit(i: number): boolean {
      if (stack.has(i)) return true;
      if (visited.has(i)) return false;
      visited.add(i);
      stack.add(i);
      const it = list[i];
      const pk = it.parent_key?.trim() || null;
      if (pk) {
        const parentIdx = keyToIndex.get(pk);
        if (parentIdx !== undefined && visit(parentIdx)) {
          stack.delete(i);
          return true;
        }
      }
      stack.delete(i);
      return false;
    }

    for (let i = 0; i < list.length; i++) {
      if (visit(i)) return i;
    }
  }
  return null;
}

/**
 * Validate pages/menu import data: structure, refs, duplicates, cycles
 */
export function validatePagesMenuImportData(data: PagesMenuExportData): PagesMenuValidationResult {
  const errors: PagesMenuValidationResult['errors'] = [];
  const warnings: NonNullable<PagesMenuValidationResult['warnings']> = [];

  const slugSet = new Set<string>();
  for (let i = 0; i < data.pages.length; i++) {
    const p = data.pages[i];
    const path = `/pages[${i}]`;
    if (!p.slug || typeof p.slug !== 'string') {
      errors.push({ path: `${path}/slug`, message: 'Missing or invalid slug', pageIndex: i });
      continue;
    }
    if (slugSet.has(p.slug)) {
      errors.push({ path: `${path}/slug`, message: `Duplicate slug: ${p.slug}`, pageIndex: i });
      continue;
    }
    slugSet.add(p.slug);
    if (!p.title || typeof p.title !== 'string') {
      errors.push({ path: `${path}/title`, message: 'Missing or invalid title', pageIndex: i });
    }
    if (p.parent_slug && !data.pages.some((x) => x.slug === p.parent_slug)) {
      errors.push({
        path: `${path}/parent_slug`,
        message: `parent_slug "${p.parent_slug}" not found in pages`,
        pageIndex: i,
      });
    }
  }

  const menuKeySet = new Map<string, Set<string>>();
  for (let i = 0; i < data.menu_items.length; i++) {
    const it = data.menu_items[i];
    const path = `/menu_items[${i}]`;
    if (!it.key || typeof it.key !== 'string') {
      errors.push({ path: `${path}/key`, message: 'Missing or invalid key', menuItemIndex: i });
      continue;
    }
    const loc = it.menu_location || 'header';
    const keys = menuKeySet.get(loc) ?? new Set<string>();
    if (keys.has(it.key)) {
      errors.push({
        path: `${path}/key`,
        message: `Duplicate (menu_location, key): (${loc}, ${it.key})`,
        menuItemIndex: i,
      });
      continue;
    }
    keys.add(it.key);
    menuKeySet.set(loc, keys);

    if (!it.label || typeof it.label !== 'string') {
      errors.push({ path: `${path}/label`, message: 'Missing or invalid label', menuItemIndex: i });
    }
    if (!it.page_slug && !it.url) {
      warnings.push({
        path: `${path}`,
        message: 'Menu item has neither page_slug nor url',
        menuItemIndex: i,
      });
    }
    if (it.page_slug && !data.pages.some((p) => p.slug === it.page_slug)) {
      errors.push({
        path: `${path}/page_slug`,
        message: `page_slug "${it.page_slug}" not found in pages`,
        menuItemIndex: i,
      });
    }
    if (it.parent_key) {
      const sameLoc = data.menu_items.filter((m) => m.menu_location === it.menu_location);
      if (!sameLoc.some((m) => m.key === it.parent_key)) {
        errors.push({
          path: `${path}/parent_key`,
          message: `parent_key "${it.parent_key}" not found in same menu_location`,
          menuItemIndex: i,
        });
      }
    }
  }

  const pageCycleIdx = pageCycleCheck(data.pages);
  if (pageCycleIdx !== null) {
    errors.push({
      path: '/pages',
      message: `Cycle in parent_slug references (page index ${pageCycleIdx})`,
      pageIndex: pageCycleIdx,
    });
  }

  const menuCycleIdx = menuCycleCheck(data.menu_items);
  if (menuCycleIdx !== null) {
    errors.push({
      path: '/menu_items',
      message: `Cycle in parent_key references (menu item index ${menuCycleIdx})`,
      menuItemIndex: menuCycleIdx,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Export pages and menu_items to JSON file (importable shape)
 */
export function exportPagesMenuToFile(
  pages: Array<{
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
    show_in_navigation?: boolean | null;
    display_order?: number | null;
    content?: Json | null;
  }>,
  menuItems: Array<{
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
  }>
): void {
  const idToSlug = new Map<string, string>();
  pages.forEach((p) => idToSlug.set(p.id, p.slug));

  const sortPages = [...pages].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const pageItems: PageImportItem[] = sortPages.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description ?? null,
    meta_title: p.meta_title ?? null,
    meta_description: p.meta_description ?? null,
    template: p.template ?? 'default',
    parent_slug: p.parent_id ? idToSlug.get(p.parent_id) ?? null : null,
    is_active: p.is_active ?? true,
    show_in_nav: p.show_in_nav ?? true,
    show_in_navigation: (p as { show_in_navigation?: boolean }).show_in_navigation ?? true,
    display_order: p.display_order ?? 0,
    content: (p.content as Record<string, unknown>) ?? null,
    source_entity_type: (p as { source_entity_type?: string | null }).source_entity_type ?? null,
    source_entity_id: (p as { source_entity_id?: string | null }).source_entity_id ?? null,
  }));

  const byLocation = new Map<string, typeof menuItems>();
  menuItems.forEach((m) => {
    const list = byLocation.get(m.menu_location) ?? [];
    list.push(m);
    byLocation.set(m.menu_location, list);
  });

  const flatMenu: MenuItemFlat[] = [];
  for (const [loc, list] of byLocation) {
    const sorted = [...list].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const byParent = new Map<string, typeof list>();
    sorted.forEach((m) => {
      const pid = m.parent_id ?? '__root';
      const arr = byParent.get(pid) ?? [];
      arr.push(m);
      byParent.set(pid, arr);
    });

    function assignKeys(parentId: string, parentKey: string | null, order: number): number {
      const children = byParent.get(parentId) ?? [];
      for (const m of children) {
        const pageSlug = m.page_id ? idToSlug.get(m.page_id) : null;
        const key = `menu-${loc}-${order}`;
        flatMenu.push({
          key,
          menu_location: loc,
          label: m.label,
          url: m.url ?? null,
          page_slug: pageSlug ?? null,
          parent_key: parentKey,
          display_order: order++,
          target: m.target ?? '_self',
          is_active: m.is_active ?? true,
          menu_type: m.menu_type ?? null,
        });
        order = assignKeys(m.id, key, order);
      }
      return order;
    }

    assignKeys('__root', null, 0);
  }

  const exportData: PagesMenuExportData = {
    version: '1.0',
    entity_type: 'pages_and_menu',
    exported_at: new Date().toISOString(),
    menu_locations: Array.from(byLocation.keys()),
    pages: pageItems,
    menu_items: flatMenu,
  };

  const formatted = JSON.stringify(exportData, null, 2);
  const blob = new Blob([formatted], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pages-menu-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
