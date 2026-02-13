import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Project {
  id: string;
  title: string;
  slug: string;
  client: string | null;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  results: string | null;
  cover_image: string | null;
  technologies: string[] | null;
  testimonial: string | null;
  testimonial_author: string | null;
  testimonial_role: string | null;
  project_url: string | null;
  is_featured: boolean | null;
  completed_at: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch portfolio/project items from Pages (source_entity_type = "portfolio").
 * Use as primary when pages are the source of truth.
 */
export const usePortfolioFromPages = (limit?: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["portfolio-from-pages", limit],
    queryFn: async () => {
      const { data: root, error: rootErr } = await supabase
        .from("pages")
        .select("id")
        .eq("slug", "portfolio")
        .is("parent_id", null)
        .eq("is_active", true)
        .maybeSingle();
      if (rootErr || !root) return [] as Project[];

      let query = supabase
        .from("pages")
        .select("id, title, slug, description, content, display_order, created_at")
        .eq("parent_id", root.id)
        .eq("is_active", true)
        .eq("source_entity_type", "portfolio")
        .order("display_order");

      if (limit) query = query.limit(limit);

      const { data: childPages, error } = await query;
      if (error || !childPages?.length) return [] as Project[];

      return childPages.map((p: { id: string; title: string; slug: string; description: string | null; content?: Record<string, unknown> | null }) => {
        const projSlug = p.slug.includes("/") ? p.slug.split("/").pop() ?? p.slug : p.slug;
        const content = (p.content as Record<string, unknown>) ?? {};
        const coverImage = (content?.cover_image as string) ?? null;
        const projectUrl = (content?.project_url as string) ?? null;
        return {
          id: p.id,
          title: p.title,
          slug: projSlug,
          client: null,
          description: p.description,
          challenge: null,
          solution: null,
          results: null,
          cover_image: coverImage,
          technologies: null,
          testimonial: null,
          testimonial_author: null,
          testimonial_role: null,
          project_url: projectUrl,
          is_featured: null,
          completed_at: null,
          display_order: 0,
          created_at: "",
          updated_at: "",
        };
      }) as Project[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
};

/**
 * Projects/portfolio with type filtering: prefers pages (source_entity_type = "portfolio"), fallback to projects table.
 */
export const useProjectsWithFilter = (limit?: number, options?: { enabled?: boolean }) => {
  const fromPages = usePortfolioFromPages(limit, options);
  const fromTable = useProjects(limit, options);

  const fromPagesData = fromPages.data ?? [];
  const fromTableData = fromTable.data ?? [];
  const displayData = fromPagesData.length > 0 ? fromPagesData : fromTableData;
  const isLoading = fromPages.isLoading || (fromPagesData.length === 0 && fromTable.isLoading);

  return {
    data: displayData,
    isLoading,
    isFromPages: fromPagesData.length > 0,
  };
};

export const useProjects = (limit?: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["projects", limit],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*")
        .order("display_order");
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Project[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
};

export const useFeaturedProjects = (limit?: number) => {
  return useQuery({
    queryKey: ["featured-projects", limit],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("is_featured", true)
        .order("display_order");
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Project[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useProjectBySlug = (slug: string) => {
  return useQuery({
    queryKey: ["project", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data as Project | null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
};

export const useProjectGallery = (projectId: string) => {
  return useQuery({
    queryKey: ["project-gallery", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_gallery")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};
