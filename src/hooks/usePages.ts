import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Page {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  content: Record<string, any> | null;
  template: string | null;
  parent_id: string | null;
  is_active: boolean | null;
  is_system: boolean | null;
  show_in_nav: boolean | null;
  display_order: number | null;
  show_in_navigation: boolean | null;
  default_menu_type: string | null;
  navigation_label_override: string | null;
  navigation_priority: number | null;
  created_at: string;
  updated_at: string;
}

export const usePages = () => {
  return useQuery({
    queryKey: ["pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data as Page[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const usePageBySlug = (slug: string) => {
  return useQuery({
    queryKey: ["page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data as Page | null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
};

export const useNavPages = () => {
  return useQuery({
    queryKey: ["nav-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .eq("is_active", true)
        .or("show_in_nav.eq.true,show_in_navigation.eq.true")
        .order("display_order");
      
      if (error) throw error;
      return data as Page[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
