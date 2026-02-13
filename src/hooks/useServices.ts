import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  features: any[] | null;
  process_steps: any[] | null;
  faqs: any[] | null;
  technologies: any[] | null;
  pricing: any[] | null;
  is_featured: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  service_categories?: ServiceCategory;
}

export const useServiceCategories = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .order("display_order");
      
      if (error) throw error;
      return data as ServiceCategory[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
};

export const useServices = () => {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, service_categories(*)")
        .order("display_order");
      
      if (error) throw error;
      return data as Service[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useFeaturedServices = () => {
  return useQuery({
    queryKey: ["featured-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, service_categories(*)")
        .eq("is_featured", true)
        .order("display_order");
      
      if (error) throw error;
      return data as Service[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useServiceBySlug = (slug: string) => {
  return useQuery({
    queryKey: ["service", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, service_categories(*)")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data as Service | null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
};

export const useServicesWithCategories = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["services-with-categories"],
    queryFn: async () => {
      const { data: categories, error: catError } = await supabase
        .from("service_categories")
        .select("*")
        .order("display_order");
      
      if (catError) throw catError;

      const { data: services, error: servError } = await supabase
        .from("services")
        .select("*")
        .order("display_order");
      
      if (servError) throw servError;

      return (categories as ServiceCategory[]).map(category => ({
        ...category,
        services: (services as Service[]).filter(s => s.category_id === category.id),
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
};

/** Page-like item from Pages & Navigation (for services tree) */
export interface ServicesPageItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  display_order: number | null;
}

/**
 * Fetch categories with their services from Pages & Navigation (with type filtering).
 * Categories: source_entity_type = "service_category"
 * Services: source_entity_type = "service"
 * Use this as primary when source of truth is Pages (Admin → Pages & Navigation).
 */
export const useServicesWithCategoriesFromPages = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["services-with-categories-from-pages"],
    queryFn: async () => {
      const { data: root, error: rootErr } = await supabase
        .from("pages")
        .select("id")
        .eq("slug", "services")
        .is("parent_id", null)
        .eq("is_active", true)
        .maybeSingle();
      if (rootErr || !root) return [] as Array<ServiceCategory & { services: Service[] }>;

      const { data: categoryPages, error: catErr } = await supabase
        .from("pages")
        .select("id, title, slug, description, display_order")
        .eq("parent_id", root.id)
        .eq("is_active", true)
        .eq("source_entity_type", "service_category")
        .order("display_order");
      if (catErr || !categoryPages?.length) return [] as Array<ServiceCategory & { services: Service[] }>;

      const result: Array<ServiceCategory & { services: Service[] }> = [];

      for (const cat of categoryPages) {
        const { data: servicePages } = await supabase
          .from("pages")
          .select("id, title, slug, description, display_order")
          .eq("parent_id", cat.id)
          .eq("is_active", true)
          .eq("source_entity_type", "service")
          .order("display_order");

        const services: Service[] = (servicePages ?? []).map((p: { id: string; title: string; slug: string; description: string | null }) => {
          const serviceSlug = p.slug.includes("/") ? p.slug.split("/").pop()! : p.slug;
          return {
            id: p.id,
            name: p.title,
            slug: serviceSlug,
            tagline: null,
            description: p.description,
            category_id: cat.id,
            icon: null,
            icon_name: null,
            image_url: null,
            features: null,
            process_steps: null,
            faqs: null,
            technologies: null,
            pricing: null,
            is_featured: null,
            display_order: 0,
            created_at: "",
            updated_at: "",
          };
        }) as Service[];

        const categorySlug = cat.slug.includes("/") ? cat.slug.split("/").pop() ?? cat.slug : cat.slug;
        result.push({
          id: cat.id,
          name: cat.title,
          slug: categorySlug,
          description: cat.description,
          icon: null,
          display_order: cat.display_order,
          created_at: "",
          updated_at: "",
          services,
        });
      }

      return result;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
};

/**
 * Fetch children of the Services root page from Pages & Navigation.
 * Use this when the source of truth is Pages (Admin → Pages & Navigation).
 */
export const useServicesChildrenFromPages = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["services-children-from-pages"],
    queryFn: async () => {
      const { data: root, error: rootErr } = await supabase
        .from("pages")
        .select("id")
        .eq("slug", "services")
        .is("parent_id", null)
        .eq("is_active", true)
        .maybeSingle();
      if (rootErr || !root) return [] as ServicesPageItem[];

      const { data: children, error } = await supabase
        .from("pages")
        .select("id, title, slug, description, display_order, source_entity_type")
        .eq("parent_id", root.id)
        .eq("is_active", true)
        .eq("source_entity_type", "service_category")
        .order("display_order");
      if (error || !children) return [] as ServicesPageItem[];

      return children as ServicesPageItem[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
};

/**
 * Fetch services under a category. Prefers pages (with type filtering), fallback to services table.
 */
export const useServicesUnderCategory = (categorySlug: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["services-under-category", categorySlug],
    queryFn: async () => {
      const catSlug = categorySlug.trim();
      if (!catSlug) return [] as Service[];

      // 1. Prefer pages (with source_entity_type = "service" filter)
      const pageSlug = `services/${catSlug}`;
      const { data: catPage, error: pageErr } = await supabase
        .from("pages")
        .select("id")
        .eq("slug", pageSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (!pageErr && catPage) {
        const { data: servicePages } = await supabase
          .from("pages")
          .select("id, title, slug, description, display_order")
          .eq("parent_id", catPage.id)
          .eq("is_active", true)
          .eq("source_entity_type", "service")
          .order("display_order");
        if (servicePages?.length) {
          return servicePages.map((p: { id: string; title: string; slug: string; description: string | null }) => {
            const serviceSlug = p.slug.includes("/") ? p.slug.split("/").pop()! : p.slug;
            return {
              id: p.id,
              name: p.title,
              slug: serviceSlug,
              tagline: null,
              description: p.description,
              category_id: catPage.id,
              icon: null,
              icon_name: null,
              image_url: null,
              features: null,
              process_steps: null,
              faqs: null,
              technologies: null,
              pricing: null,
              is_featured: null,
              display_order: 0,
              created_at: "",
              updated_at: "",
            };
          }) as Service[];
        }
      }

      // 2. Fallback: services table via service_categories
      const { data: cat, error: catErr } = await supabase
        .from("service_categories")
        .select("id")
        .eq("slug", catSlug)
        .maybeSingle();
      if (!catErr && cat) {
        const { data: svc, error: svcErr } = await supabase
          .from("services")
          .select("*, service_categories(*)")
          .eq("category_id", cat.id)
          .order("display_order");
        if (!svcErr && svc?.length) return svc as Service[];
      }

      return [] as Service[];
    },
    enabled: (options?.enabled !== false) && !!categorySlug.trim(),
    staleTime: 5 * 60 * 1000,
  });
};
