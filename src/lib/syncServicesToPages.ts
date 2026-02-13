import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncResult {
  success: boolean;
  error?: string;
  created?: boolean;
  updated?: boolean;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number | null;
}

interface ServiceRow {
  id: string;
  category_id: string;
  slug: string;
  title?: string;
  name?: string;
  tagline?: string | null;
  description?: string | null;
  icon?: string | null;
  icon_name?: string | null;
  display_order: number;
}

/** Get service display title - handles schema variance (name vs title) */
function getServiceTitle(service: ServiceRow): string {
  return (service as Record<string, unknown>).title as string
    ?? (service as Record<string, unknown>).name as string
    ?? service.slug;
}

/** Get service icon - handles icon vs icon_name */
function getServiceIcon(service: ServiceRow): string | null {
  return (service as Record<string, unknown>).icon_name as string | null
    ?? (service as Record<string, unknown>).icon as string | null
    ?? null;
}

/**
 * Get or create the root "services" page. Must exist before syncing categories.
 * Finds existing page by slug case-insensitively (services, Services, etc.) and root-level (parent_id null).
 */
export async function ensureServicesRootPage(
  supabase: SupabaseClient
): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: fetchErr } = await supabase
    .from("pages")
    .select("id")
    .is("parent_id", null)
    .ilike("slug", "services")
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (existing) return { id: existing.id };

  const { data: inserted, error: insertErr } = await supabase
    .from("pages")
    .insert({
      title: "Services",
      slug: "services",
      description: "Our comprehensive digital solutions",
      template: "default",
      parent_id: null,
      is_active: true,
      is_system: true,
      show_in_nav: true,
      show_in_navigation: true,
      display_order: 2,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!inserted) return { error: "Failed to create services root page" };
  return { id: inserted.id };
}

/**
 * Get page by slug. Returns null if not found.
 */
async function getPageBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ id: string; parent_id: string | null; source_entity_type: string | null; source_entity_id: string | null } | null> {
  const { data, error } = await supabase
    .from("pages")
    .select("id, parent_id, source_entity_type, source_entity_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; parent_id: string | null; source_entity_type: string | null; source_entity_id: string | null };
}

/** Extract category slug from a page slug under services (e.g. "services/designing" → "designing"). */
function categorySlugFromPageSlug(pageSlug: string): string | null {
  if (!pageSlug.startsWith("services/")) return null;
  const after = pageSlug.replace("services/", "").trim();
  const firstSegment = after.split("/")[0];
  return firstSegment || null;
}

/**
 * Sync a page (child of Services) to service_categories so categories come from Pages.
 * Creates or updates a service_category row and links the page to it (source_entity_type, source_entity_id).
 * Call this when saving a page in Pages & Navigation whose parent is the Services root.
 */
export async function syncPageToServiceCategory(
  supabase: SupabaseClient,
  page: {
    id: string;
    title: string;
    slug: string;
    parent_id: string | null;
    display_order?: number | null;
    description?: string | null;
    source_entity_type?: string | null;
    source_entity_id?: string | null;
  }
): Promise<SyncResult> {
  const root = await ensureServicesRootPage(supabase);
  if ("error" in root) return { success: false, error: root.error };
  const servicesRootId = root.id;

  if (page.parent_id !== servicesRootId) return { success: true };

  const categorySlug = categorySlugFromPageSlug(page.slug);
  if (!categorySlug) return { success: false, error: "Page slug must be services/<category-slug>" };

  const now = new Date().toISOString();
  const categoryPayload = {
    name: page.title,
    slug: categorySlug,
    description: page.description ?? null,
    display_order: page.display_order ?? 0,
    updated_at: now,
  };

  let categoryId: string;

  if (page.source_entity_type === "service_category" && page.source_entity_id) {
    categoryId = page.source_entity_id;
    const { error } = await supabase
      .from("service_categories")
      .update(categoryPayload)
      .eq("id", categoryId);
    if (error) return { success: false, error: error.message };
  } else {
    const { data: existing } = await supabase
      .from("service_categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (existing) {
      categoryId = existing.id;
      const { error } = await supabase
        .from("service_categories")
        .update(categoryPayload)
        .eq("id", categoryId);
      if (error) return { success: false, error: error.message };
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("service_categories")
        .insert({
          ...categoryPayload,
          created_at: now,
        } as Record<string, unknown>)
        .select("id")
        .single();
      if (insertErr) return { success: false, error: insertErr.message };
      if (!inserted?.id) return { success: false, error: "Failed to create service_category" };
      categoryId = inserted.id;
    }

    const { error: pageErr } = await supabase
      .from("pages")
      .update({
        source_entity_type: "service_category",
        source_entity_id: categoryId,
        updated_at: now,
      })
      .eq("id", page.id);
    if (pageErr) return { success: false, error: pageErr.message };
  }

  return { success: true, updated: true };
}

/**
 * Ensure all direct children of the Services page have a service_category (Pages as source of truth).
 * Call on Admin Pages load so categories stay in sync with the Pages list.
 */
export async function syncServiceCategoriesFromPages(
  supabase: SupabaseClient
): Promise<{ synced: number; errors: string[] }> {
  const root = await ensureServicesRootPage(supabase);
  if ("error" in root) return { synced: 0, errors: [root.error] };

  const { data: children, error: fetchErr } = await supabase
    .from("pages")
    .select("id, title, slug, parent_id, display_order, description, source_entity_type, source_entity_id")
    .eq("parent_id", root.id)
    .order("display_order");

  if (fetchErr) return { synced: 0, errors: [fetchErr.message] };
  if (!children?.length) return { synced: 0, errors: [] };

  let count = 0;
  const errs: string[] = [];
  for (const page of children as Array<{
    id: string;
    title: string;
    slug: string;
    parent_id: string | null;
    display_order: number | null;
    description: string | null;
    source_entity_type: string | null;
    source_entity_id: string | null;
  }>) {
    const r = await syncPageToServiceCategory(supabase, page);
    if (r.success && r.updated) count++;
    if (r.error) errs.push(`${page.slug}: ${r.error}`);
  }
  return { synced: count, errors: errs };
}

/**
 * Sync a service category to a page.
 * Creates or updates page with slug services/{category.slug}.
 */
export async function syncCategoryToPage(
  supabase: SupabaseClient,
  category: CategoryRow,
  mode: "create" | "update"
): Promise<SyncResult> {
  const slug = `services/${category.slug}`;

  const root = await ensureServicesRootPage(supabase);
  if ("error" in root) return { success: false, error: root.error };
  const servicesRootId = root.id;

  const existing = await getPageBySlug(supabase, slug);

  // Manual page: source_entity_type is null - skip to avoid overwriting
  if (existing && existing.source_entity_type === null) {
    return { success: true, updated: false, created: false };
  }

  const pageData = {
    title: category.name,
    description: category.description ?? null,
    display_order: category.display_order ?? 0,
    parent_id: servicesRootId,
    is_active: true,
    show_in_nav: true,
    show_in_navigation: true,
    source_entity_type: "service_category" as const,
    source_entity_id: category.id,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    if (existing.source_entity_id !== category.id) {
      return { success: true, updated: false, created: false };
    }
    const { error } = await supabase
      .from("pages")
      .update(pageData)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
    return { success: true, updated: true };
  }

  const { error } = await supabase
    .from("pages")
    .insert({
      ...pageData,
      slug,
      template: "default",
      is_system: false,
    } as Record<string, unknown>);

  if (error) return { success: false, error: error.message };
  return { success: true, created: true };
}

/**
 * Delete a service page by exact slug (e.g. when service moves to different category).
 */
async function deleteServicePageBySlug(
  supabase: SupabaseClient,
  pageSlug: string,
  serviceId: string
): Promise<void> {
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", pageSlug)
    .eq("source_entity_type", "service")
    .eq("source_entity_id", serviceId)
    .maybeSingle();

  if (page) {
    await supabase.from("pages").delete().eq("id", page.id);
  }
}

/**
 * Sync a service to a page.
 * Creates or updates page with slug services/{categorySlug}/{serviceSlug}.
 * When oldCategorySlug is provided and differs from current, deletes the old page first.
 */
export async function syncServiceToPage(
  supabase: SupabaseClient,
  service: ServiceRow,
  category: CategoryRow,
  mode: "create" | "update",
  oldCategorySlug?: string
): Promise<SyncResult> {
  const categorySlug = `services/${category.slug}`;
  const serviceSlug = `${categorySlug}/${service.slug}`;

  if (oldCategorySlug && oldCategorySlug !== category.slug) {
    const oldPageSlug = `services/${oldCategorySlug}/${service.slug}`;
    await deleteServicePageBySlug(supabase, oldPageSlug, service.id);
  }

  const categoryPage = await getPageBySlug(supabase, categorySlug);
  if (!categoryPage) {
    return { success: false, error: `Category page not found: ${categorySlug}. Create the category first.` };
  }

  const existing = await getPageBySlug(supabase, serviceSlug);

  if (existing && existing.source_entity_type === null) {
    return { success: true, updated: false, created: false };
  }

  const title = getServiceTitle(service);
  const pageData = {
    title,
    description: service.description ?? service.tagline ?? null,
    display_order: service.display_order ?? 0,
    parent_id: categoryPage.id,
    is_active: true,
    show_in_nav: true,
    show_in_navigation: true,
    source_entity_type: "service" as const,
    source_entity_id: service.id,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    if (existing.source_entity_id !== service.id) {
      return { success: true, updated: false, created: false };
    }
    const { error } = await supabase
      .from("pages")
      .update(pageData)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
    return { success: true, updated: true };
  }

  const { error } = await supabase
    .from("pages")
    .insert({
      ...pageData,
      slug: serviceSlug,
      template: "default",
      is_system: false,
    } as Record<string, unknown>);

  if (error) return { success: false, error: error.message };
  return { success: true, created: true };
}

/**
 * Rebuild the services-grid section for a category from the services table.
 * Creates section if missing; updates content.items to match services.
 */
export async function syncServicesGridSection(
  supabase: SupabaseClient,
  categorySlug: string
): Promise<SyncResult> {
  const pageType = `services/${categorySlug}`;

  const { data: catData } = await supabase
    .from("service_categories")
    .select("id")
    .eq("slug", categorySlug)
    .single();

  if (!catData) return { success: false, error: `Category not found: ${categorySlug}` };

  const { data: servicesList, error: servicesErr } = await supabase
    .from("services")
    .select("id, slug, title, name, tagline, description, icon, icon_name, display_order")
    .eq("category_id", catData.id)
    .order("display_order");

  if (servicesErr) return { success: false, error: servicesErr.message };

  const items = (servicesList ?? []).map((s: ServiceRow) => ({
    title: getServiceTitle(s),
    description: (s.description ?? s.tagline ?? "").toString().slice(0, 200),
    icon: getServiceIcon(s) ?? "Briefcase",
    link: `/services/${categorySlug}/${s.slug}`,
  }));

  const { data: existingSection } = await supabase
    .from("page_sections")
    .select("id, content")
    .eq("page_type", pageType)
    .eq("section_type", "services-grid")
    .maybeSingle();

  const content = { items };

  if (existingSection) {
    const { error: updateErr } = await supabase
      .from("page_sections")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existingSection.id);

    if (updateErr) return { success: false, error: updateErr.message };
    return { success: true, updated: true };
  }

  const { error: insertErr } = await supabase.from("page_sections").insert({
    page_type: pageType,
    section_type: "services-grid",
    content,
    display_order: 0,
    is_active: true,
  });

  if (insertErr) return { success: false, error: insertErr.message };
  return { success: true, created: true };
}

/**
 * One-time migration: sync all existing categories and services to pages.
 * Call after deploying auto-sync to populate pages for existing data.
 */
export async function migrateExistingToPages(
  supabase: SupabaseClient
): Promise<{ categoriesSynced: number; servicesSynced: number; errors: string[] }> {
  const result = { categoriesSynced: 0, servicesSynced: 0, errors: [] as string[] };

  const { data: categories, error: catErr } = await supabase
    .from("service_categories")
    .select("*")
    .order("display_order");

  if (catErr) {
    result.errors.push(`Categories: ${catErr.message}`);
    return result;
  }

  const { data: servicesList, error: servErr } = await supabase
    .from("services")
    .select("*")
    .order("display_order");

  if (servErr) {
    result.errors.push(`Services: ${servErr.message}`);
    return result;
  }

  const catById = new Map((categories ?? []).map((c) => [c.id, c]));

  for (const cat of categories ?? []) {
    const r = await syncCategoryToPage(supabase, cat, "create");
    if (r.success && (r.created || r.updated)) result.categoriesSynced++;
    if (r.error) result.errors.push(`Category ${cat.slug}: ${r.error}`);
  }

  for (const svc of servicesList ?? []) {
    const cat = catById.get(svc.category_id);
    if (!cat) continue;
    const serviceWithTitle = { ...svc, title: (svc as Record<string, unknown>).title ?? (svc as Record<string, unknown>).name };
    const r = await syncServiceToPage(supabase, serviceWithTitle, cat, "create");
    if (r.success && (r.created || r.updated)) result.servicesSynced++;
    if (r.error) result.errors.push(`Service ${svc.slug}: ${r.error}`);
  }

  for (const cat of categories ?? []) {
    const r = await syncServicesGridSection(supabase, cat.slug);
    if (r.error) result.errors.push(`Grid ${cat.slug}: ${r.error}`);
  }

  return result;
}

/**
 * Delete the category page and all child service pages.
 * Also removes the services-grid section for this category.
 */
export async function cleanupCategoryPage(
  supabase: SupabaseClient,
  categoryId: string,
  categorySlug?: string
): Promise<SyncResult> {
  let slug = categorySlug;
  if (!slug) {
    const { data: cat } = await supabase
      .from("service_categories")
      .select("slug")
      .eq("id", categoryId)
      .single();
    slug = cat?.slug;
  }
  if (!slug) return { success: false, error: "Category not found" };

  const pageSlug = `services/${slug}`;

  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("source_entity_type", "service_category")
    .eq("source_entity_id", categoryId)
    .maybeSingle();

  if (page) {
    const { data: childPages } = await supabase
      .from("pages")
      .select("id")
      .eq("parent_id", page.id);

    if (childPages?.length) {
      for (const p of childPages) {
        await supabase.from("pages").delete().eq("id", p.id);
      }
    }

    const { error: delErr } = await supabase.from("pages").delete().eq("id", page.id);
    if (delErr) return { success: false, error: delErr.message };
  }

  const { data: section } = await supabase
    .from("page_sections")
    .select("id")
    .eq("page_type", pageSlug)
    .eq("section_type", "services-grid")
    .maybeSingle();

  if (section) {
    await supabase.from("page_sections").delete().eq("id", section.id);
  }

  return { success: true };
}

/**
 * Delete the service page and remove from services-grid section.
 */
export async function cleanupServicePage(
  supabase: SupabaseClient,
  serviceId: string,
  categorySlug?: string,
  serviceSlug?: string
): Promise<SyncResult> {
  const { data: page } = await supabase
    .from("pages")
    .select("id, slug")
    .eq("source_entity_type", "service")
    .eq("source_entity_id", serviceId)
    .maybeSingle();

  let catSlug = categorySlug;
  let srvSlug = serviceSlug;

  if (!catSlug || !srvSlug) {
    if (page?.slug) {
      const parts = (page.slug as string).split("/");
      catSlug = catSlug ?? parts[1];
      srvSlug = srvSlug ?? parts[2];
    } else {
      const { data: service } = await supabase
        .from("services")
        .select("category_id, slug")
        .eq("id", serviceId)
        .single();
      if (service) {
        const { data: cat } = await supabase
          .from("service_categories")
          .select("slug")
          .eq("id", (service as { category_id: string }).category_id)
          .single();
        catSlug = catSlug ?? cat?.slug;
        srvSlug = srvSlug ?? (service as { slug: string }).slug;
      }
    }
  }

  if (catSlug && srvSlug) {
    await removeServiceFromGrid(supabase, catSlug, srvSlug);
  }

  if (page) {
    const { error } = await supabase.from("pages").delete().eq("id", page.id);
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Sync page changes back to the linked service_category.
 * Updates name, description, display_order on the category.
 */
export async function syncPageToCategory(
  supabase: SupabaseClient,
  page: { source_entity_id: string; title?: string | null; description?: string | null; display_order?: number | null }
): Promise<SyncResult> {
  if (!page.source_entity_id) return { success: false, error: "Missing source_entity_id" };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (page.title != null) updates.name = page.title;
  if (page.description !== undefined) updates.description = page.description;
  if (page.display_order != null) updates.display_order = page.display_order;

  const { error } = await supabase
    .from("service_categories")
    .update(updates)
    .eq("id", page.source_entity_id);

  if (error) return { success: false, error: error.message };
  return { success: true, updated: true };
}

/**
 * Sync page changes back to the linked service.
 * Updates name/title, description, display_order on the service.
 */
export async function syncPageToService(
  supabase: SupabaseClient,
  page: { source_entity_id: string; title?: string | null; description?: string | null; display_order?: number | null },
  categorySlug?: string
): Promise<SyncResult> {
  if (!page.source_entity_id) return { success: false, error: "Missing source_entity_id" };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (page.title != null) updates.title = page.title;
  if (page.description !== undefined) updates.description = page.description;
  if (page.display_order != null) updates.display_order = page.display_order;

  const { error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", page.source_entity_id);

  if (error) return { success: false, error: error.message };

  if (categorySlug) {
    const gridResult = await syncServicesGridSection(supabase, categorySlug);
    if (!gridResult.success) return gridResult;
  }

  return { success: true, updated: true };
}

/**
 * When deleting a source-linked page, also delete the linked service or service_category.
 * Cleanup functions remove pages; we then delete the source entity.
 */
export async function deleteSourceEntityWhenPageDeleted(
  supabase: SupabaseClient,
  page: { source_entity_type: string | null; source_entity_id: string | null; slug?: string }
): Promise<SyncResult> {
  if (!page.source_entity_type || !page.source_entity_id) return { success: true };

  const catSlug = page.slug?.startsWith("services/") ? page.slug.replace("services/", "").split("/")[0] : undefined;

  if (page.source_entity_type === "service_category") {
    const { count, error: countErr } = await supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("category_id", page.source_entity_id);
    if (!countErr && (count ?? 0) > 0) {
      return {
        success: false,
        error:
          "This category has services. First delete all of those services, then you will be able to delete this category.",
      };
    }
    const cleanupResult = await cleanupCategoryPage(supabase, page.source_entity_id, catSlug);
    if (!cleanupResult.success) return cleanupResult;
    const { error } = await supabase.from("service_categories").delete().eq("id", page.source_entity_id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  if (page.source_entity_type === "service") {
    const parts = (page.slug ?? "").split("/");
    const srvSlug = parts[2];
    const cleanupResult = await cleanupServicePage(supabase, page.source_entity_id, catSlug, srvSlug);
    if (!cleanupResult.success) return cleanupResult;
    const { error } = await supabase.from("services").delete().eq("id", page.source_entity_id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  return { success: true };
}

async function removeServiceFromGrid(
  supabase: SupabaseClient,
  categorySlug: string,
  serviceSlug: string
): Promise<void> {
  const pageType = `services/${categorySlug}`;
  const link = `/services/${categorySlug}/${serviceSlug}`;

  const { data: section } = await supabase
    .from("page_sections")
    .select("id, content")
    .eq("page_type", pageType)
    .eq("section_type", "services-grid")
    .maybeSingle();

  if (section?.content && typeof section.content === "object") {
    const content = section.content as { items?: Array<{ link?: string }> };
    const items = (content.items ?? []).filter((item) => item.link !== link);
    await supabase
      .from("page_sections")
      .update({ content: { ...content, items }, updated_at: new Date().toISOString() })
      .eq("id", section.id);
  }
}
