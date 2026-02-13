import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  author_id: string | null;
  is_published: boolean | null;
  published_at: string | null;
  read_time: number | null;
  views: number | null;
  created_at: string;
  updated_at: string;
  team_members?: {
    id: string;
    name: string;
    role: string;
    image_url: string | null;
  };
  blog_post_categories?: {
    category_id: string;
    blog_categories: BlogCategory;
  }[];
}

/**
 * Fetch blog posts from Pages (source_entity_type = "blog").
 * Use as primary when pages are the source of truth.
 */
export const useBlogPostsFromPages = (limit?: number) => {
  return useQuery({
    queryKey: ["blog-posts-from-pages", limit],
    queryFn: async () => {
      const { data: root, error: rootErr } = await supabase
        .from("pages")
        .select("id")
        .eq("slug", "blog")
        .is("parent_id", null)
        .eq("is_active", true)
        .maybeSingle();
      if (rootErr || !root) return [] as BlogPost[];

      let query = supabase
        .from("pages")
        .select("id, title, slug, description, content, display_order, created_at, updated_at")
        .eq("parent_id", root.id)
        .eq("is_active", true)
        .eq("source_entity_type", "blog")
        .order("display_order");

      if (limit) query = query.limit(limit);

      const { data: childPages, error } = await query;
      if (error || !childPages?.length) return [] as BlogPost[];

      return childPages.map((p: { id: string; title: string; slug: string; description: string | null; content?: Record<string, unknown> | null }) => {
        const postSlug = p.slug.includes("/") ? p.slug.split("/").pop() ?? p.slug : p.slug;
        const content = (p.content as Record<string, unknown>) ?? {};
        const coverImage = (content?.cover_image as string) ?? null;
        const readTime = typeof content?.read_time === "number" ? content.read_time : null;
        return {
          id: p.id,
          title: p.title,
          slug: postSlug,
          excerpt: p.description,
          content: null,
          cover_image: coverImage,
          author_id: null,
          is_published: true,
          published_at: null,
          read_time: readTime,
          views: null,
          created_at: "",
          updated_at: "",
        };
      }) as BlogPost[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Blog posts with type filtering: prefers pages (source_entity_type = "blog"), fallback to blog_posts table.
 */
export const useBlogPostsWithFilter = (limit?: number) => {
  const fromPages = useBlogPostsFromPages(limit);
  const fromTable = useBlogPosts(limit);

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

export const useBlogPosts = (limit?: number) => {
  return useQuery({
    queryKey: ["blog-posts", limit],
    queryFn: async () => {
      let query = supabase
        .from("blog_posts")
        .select(`
          *,
          team_members(id, name, role, image_url),
          blog_post_categories(
            category_id,
            blog_categories(*)
          )
        `)
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as BlogPost[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useBlogPostBySlug = (slug: string) => {
  return useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(`
          *,
          team_members(id, name, role, image_url),
          blog_post_categories(
            category_id,
            blog_categories(*)
          )
        `)
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data as BlogPost | null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
};

export const useBlogCategories = () => {
  return useQuery({
    queryKey: ["blog-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_categories")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as BlogCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
