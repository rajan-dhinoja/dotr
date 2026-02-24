/**
 * Tree-building utilities for import review (Pages and Menu items).
 * Builds hierarchical structures from flat arrays using parent_slug / parent_key.
 */


/** Status for import review rows */
export type ImportRowStatus = 'new' | 'existing' | 'conflict' | 'warning';

/** Page tree node for hierarchical import review */
export interface PageReviewTreeNode {
  id: string;
  index: number;
  slug: string;
  title: string;
  parentSlug: string | null;
  level: number;
  children: PageReviewTreeNode[];
  hasExisting?: boolean;
  hasConflict?: boolean;
  hasWarning?: boolean;
}

/** Menu item tree node for hierarchical import review */
export interface MenuReviewTreeNode {
  id: string;
  index: number;
  key: string;
  label: string;
  parentKey: string | null;
  level: number;
  children: MenuReviewTreeNode[];
  menu_location: string;
  pageSlug: string | null;
  hasExisting?: boolean;
  hasConflict?: boolean;
  hasWarning?: boolean;
}

/** Input row for page tree building (includes validation status) */
export interface PageReviewRowInput {
  id: string;
  index: number;
  slug: string;
  title: string;
  parentSlug: string | null;
  hasExisting?: boolean;
  hasConflict?: boolean;
  hasWarning?: boolean;
}

/** Input row for menu tree building */
export interface MenuReviewRowInput {
  id: string;
  index: number;
  location: string;
  label: string;
  key: string;
  parentKey: string | null;
  pageSlug: string | null;
  hasExisting?: boolean;
  hasConflict?: boolean;
  hasWarning?: boolean;
}

/**
 * Build a tree of page review nodes from flat rows using parent_slug.
 * Sorts siblings by display_order (via original array order) then slug.
 */
export function buildPageReviewTree(rows: PageReviewRowInput[]): PageReviewTreeNode[] {
  const bySlug = new Map<string, PageReviewTreeNode>();
  rows.forEach((r) => {
    bySlug.set(r.slug, {
      id: r.id,
      index: r.index,
      slug: r.slug,
      title: r.title,
      parentSlug: r.parentSlug,
      level: 0,
      children: [],
      hasExisting: r.hasExisting,
      hasConflict: r.hasConflict,
      hasWarning: r.hasWarning,
    });
  });

  const roots: PageReviewTreeNode[] = [];
  bySlug.forEach((node) => {
    const parent = node.parentSlug ? bySlug.get(node.parentSlug) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const assignLevel = (nodes: PageReviewTreeNode[], level: number) => {
    nodes.sort((a, b) => {
      const orderA = rows.find((r) => r.id === a.id)?.index ?? 0;
      const orderB = rows.find((r) => r.id === b.id)?.index ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.slug.localeCompare(b.slug);
    });
    nodes.forEach((n) => {
      n.level = level;
      assignLevel(n.children, level + 1);
    });
  };
  assignLevel(roots, 0);
  return roots;
}

/**
 * Build a tree of menu review nodes from flat rows using parent_key.
 * Returns a map of menu_location -> tree roots.
 * Sorts siblings by display_order then label.
 */
export function buildMenuReviewTree(rows: MenuReviewRowInput[]): Map<string, MenuReviewTreeNode[]> {
  const byKey = new Map<string, MenuReviewTreeNode>();
  rows.forEach((r) => {
    byKey.set(r.key, {
      id: r.id,
      index: r.index,
      key: r.key,
      label: r.label,
      parentKey: r.parentKey,
      level: 0,
      children: [],
      menu_location: r.location,
      pageSlug: r.pageSlug,
      hasExisting: r.hasExisting,
      hasConflict: r.hasConflict,
      hasWarning: r.hasWarning,
    });
  });

  const rootsByLocation = new Map<string, MenuReviewTreeNode[]>();
  byKey.forEach((node) => {
    const parent = node.parentKey ? byKey.get(node.parentKey) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      const loc = node.menu_location;
      const list = rootsByLocation.get(loc) ?? [];
      list.push(node);
      rootsByLocation.set(loc, list);
    }
  });

  const assignLevel = (nodes: MenuReviewTreeNode[], level: number) => {
    nodes.sort((a, b) => {
      const orderA = rows.find((r) => r.id === a.id)?.index ?? 0;
      const orderB = rows.find((r) => r.id === b.id)?.index ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.label.localeCompare(b.label);
    });
    nodes.forEach((n) => {
      n.level = level;
      assignLevel(n.children, level + 1);
    });
  };

  rootsByLocation.forEach((roots) => assignLevel(roots, 0));
  return rootsByLocation;
}

/**
 * Flatten a tree to a list (depth-first) for rendering with optional filtering.
 */
export function flattenPageTree(nodes: PageReviewTreeNode[]): PageReviewTreeNode[] {
  const out: PageReviewTreeNode[] = [];
  function walk(ns: PageReviewTreeNode[]) {
    ns.forEach((n) => {
      out.push(n);
      walk(n.children);
    });
  }
  walk(nodes);
  return out;
}

export function flattenMenuTree(nodes: MenuReviewTreeNode[]): MenuReviewTreeNode[] {
  const out: MenuReviewTreeNode[] = [];
  function walk(ns: MenuReviewTreeNode[]) {
    ns.forEach((n) => {
      out.push(n);
      walk(n.children);
    });
  }
  walk(nodes);
  return out;
}
