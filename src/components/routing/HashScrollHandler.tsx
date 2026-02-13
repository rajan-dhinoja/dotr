import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToAnchor } from "@/lib/scrollToAnchor";

/**
 * Global hash-based scroll handler.
 *
 * Listens for location changes and, when a hash is present, scrolls the
 * corresponding element into view using `scrollToAnchor`.
 */
export function HashScrollHandler() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    scrollToAnchor(location.hash);
  }, [location.pathname, location.hash]);

  return null;
}

