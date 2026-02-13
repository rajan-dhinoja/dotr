import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { prefetchPageSections } from "@/hooks/usePageSections";

const MAIN_PAGE_TYPES = ["home", "about", "contact", "services", "portfolio", "blog", "testimonials"] as const;

/**
 * Prefetches page sections for main nav pages so that when the user navigates
 * (e.g. to About), data is often already in cache and content appears instantly.
 */
export function PrefetchNavSections() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    const t = setTimeout(() => {
      MAIN_PAGE_TYPES.forEach((pageType) => {
        prefetchPageSections(queryClient, pageType).catch(() => {});
      });
    }, 100);

    return () => clearTimeout(t);
  }, [queryClient, location.pathname]);

  return null;
}
