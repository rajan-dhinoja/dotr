import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMegaMenu } from "@/hooks/useMegaMenu";
import { resolveIcon, transformToMegaMenu, type MegaMenuDefinition } from "@/lib/menuUtils";
import { Skeleton } from "@/components/ui/skeleton";
import type { NavigationTreeItem } from "@/hooks/useNavigationMenu";

interface MegaMenuProps {
  label: string;
  href: string;
  slug?: string;
  menuItemId?: string;
  menuItem?: NavigationTreeItem; // Full menu item tree for direct transformation
  isActive: boolean;
}

export const MegaMenu = ({ label, href, slug, menuItemId, menuItem, isActive }: MegaMenuProps) => {
  const [open, setOpen] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Extract slug from href if not provided
  const extractSlugFromHref = (href: string): string | null => {
    if (!href || href === '/') return null;
    const slug = href.replace(/^\//, '').split('/')[0].toLowerCase();
    return slug || null;
  };

  // Use menuItemId, slug (from prop or extracted from href), or normalized label to identify the menu item
  // Prefer slug over label for better matching with database menu items
  const extractedSlug = slug || extractSlugFromHref(href);
  const identifier = menuItemId || extractedSlug || label.toLowerCase();

  // If we have the full menuItem, try to transform it directly (optimization)
  const directMegaMenuData = React.useMemo(() => {
    if (menuItem && menuItem.menu_type === 'mega' && menuItem.children && menuItem.children.length > 0) {
      // Build pages map from menu item tree
      const pagesMap = new Map<string, string>();
      const collectPages = (item: NavigationTreeItem) => {
        if ((item as any).page?.slug) {
          pagesMap.set(item.page_id!, (item as any).page.slug);
        }
        item.children?.forEach(collectPages);
      };
      collectPages(menuItem);
      
      return transformToMegaMenu(menuItem, pagesMap);
    }
    return null;
  }, [menuItem]);

  // Fetch mega menu data only when shouldFetch is true and we don't have direct data
  const { data: fetchedMegaMenuData, isLoading, isError } = useMegaMenu(
    shouldFetch && !directMegaMenuData ? identifier : null,
    "header",
    { enabled: shouldFetch && !directMegaMenuData }
  );

  // Use direct data if available, otherwise use fetched data
  const megaMenuData = directMegaMenuData || fetchedMegaMenuData;

  // Reset selected category when menu opens or data changes
  useEffect(() => {
    if (open && megaMenuData && megaMenuData.sections.length > 0) {
      setSelectedCategoryIndex(0);
    }
  }, [open, megaMenuData]);

  // Debug logging for query results (can be removed in production)
  useEffect(() => {
    if (shouldFetch && process.env.NODE_ENV === 'development') {
      console.log('[MegaMenu] Query state:', {
        identifier,
        isLoading,
        isError,
        hasData: !!megaMenuData,
        sectionsCount: megaMenuData?.sections?.length || 0
      });
    }
  }, [shouldFetch, identifier, isLoading, isError, megaMenuData]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Handle keyboard navigation (Escape) and focusout to close when focus leaves
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setShouldFetch(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Close when focus leaves the entire menu (trigger + dropdown)
  useEffect(() => {
    if (!open || !menuRef.current) return;

    const el = menuRef.current;
    const handleFocusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node)) {
        setOpen(false);
      }
    };

    el.addEventListener("focusout", handleFocusOut);
    return () => el.removeEventListener("focusout", handleFocusOut);
  }, [open]);

  // Focus trap when menu is open (Tab cycles within dropdown; do not steal focus on open)
  useEffect(() => {
    if (!open || !menuRef.current) return;

    const focusableElements = menuRef.current.querySelectorAll(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open, megaMenuData]);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Start fetching on hover
    setShouldFetch(true);
    // Small delay before opening to allow data to load
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, 100);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
      setTimeout(() => setShouldFetch(false), 500);
      timeoutRef.current = null;
    }, 150);
  }, []);

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShouldFetch(true);
    setOpen((prev) => !prev);
  }, []);

  const handleTriggerFocus = useCallback(() => {
    setShouldFetch(true);
    setOpen(true);
  }, []);

  // Determine if this is a mega menu (has menu_type='mega' or has children)
  const isMegaMenu = menuItem?.menu_type === 'mega' || (menuItem?.children && menuItem.children.length > 0);
  
  // For simple menus, just show a link
  if (!isMegaMenu && !shouldFetch) {
    return (
      <Link
        to={href}
        className={cn(
          "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg group flex items-center gap-1",
          isActive
            ? "text-primary"
            : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
        )}
      >
        <span className="relative z-10">{label}</span>
        {isActive && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
        )}
      </Link>
    );
  }

  // Render mega menu: Link (navigates) + chevron (toggles dropdown). Hover opens; click link navigates.
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={menuRef}
    >
      <div className="flex items-center rounded-lg group/trigger">
        <Link
          to={href}
          onFocus={handleTriggerFocus}
          className={cn(
            "relative px-4 py-2 pl-4 pr-2 text-sm font-medium transition-all duration-300 rounded-l-lg flex items-center",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-lg",
            isActive
              ? "text-primary"
              : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span className="relative z-10">{label}</span>
          {isActive && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
          )}
        </Link>
        <button
          type="button"
          onClick={handleChevronClick}
          onFocus={handleTriggerFocus}
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls={`mega-menu-${identifier}`}
          aria-label={`Open ${label} submenu`}
          className={cn(
            "p-2 rounded-r-lg transition-all duration-300",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-lg",
            isActive
              ? "text-primary"
              : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
          )}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </div>

      {open && (
        <div
          id={`mega-menu-${identifier}`}
          className="absolute left-1/2 top-full z-[60] w-screen max-w-6xl -translate-x-1/2"
          role="menu"
          aria-label={`${label} submenu`}
        >
          {/* Invisible bridge to fill any gap */}
          <div className="absolute -top-1 left-0 right-0 h-1" />
          <div className="mt-1 overflow-hidden rounded-3xl bg-background/95 shadow-2xl shadow-background/20 ring-1 ring-border/60 backdrop-blur">
            {isLoading && shouldFetch ? (
              // Loading state - match three-column layout
              <div className="grid grid-cols-1 md:grid-cols-12 gap-0 min-h-[400px]">
                <div className="md:col-span-3 bg-gradient-to-br from-cyan-500 to-teal-600 p-6 lg:p-8 rounded-tl-3xl md:rounded-bl-3xl">
                  <Skeleton className="h-8 w-48 mb-4 bg-white/20" />
                  <Skeleton className="h-4 w-full mb-2 bg-white/20" />
                  <Skeleton className="h-4 w-3/4 mb-6 bg-white/20" />
                  <Skeleton className="h-10 w-32 rounded-full bg-white/20" />
                </div>
                <div className="md:col-span-3 bg-white border-r border-border/50 p-4">
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </div>
                <div className="md:col-span-6 bg-white p-6 lg:p-8 rounded-br-3xl">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex flex-col items-center space-y-2">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (megaMenuData && (!isLoading || !shouldFetch)) ? (
              // Mega menu with data - THREE COLUMN HORIZONTAL LAYOUT
              <div className={cn(
                "grid gap-0 min-h-[400px]",
                // Responsive grid: mobile stacks, tablet/desktop uses columns
                "grid-cols-1 md:grid-cols-12",
                // Adjust column spans based on whether summary panel exists
                // Right panel (sub-services) should be more prominent
                megaMenuData.summaryTitle || megaMenuData.summaryText
                  ? "md:grid-cols-[1fr_auto_3fr]"
                  : "md:grid-cols-[auto_3fr]"
              )}>
                {/* Left Panel: Summary Panel with Gradient Background */}
                {(megaMenuData.summaryTitle || megaMenuData.summaryText) && (
                  <div className="md:col-span-1 bg-gradient-to-br from-cyan-500 to-teal-600 text-white p-6 lg:p-8 rounded-tl-3xl md:rounded-bl-3xl md:rounded-tr-none rounded-tr-3xl flex flex-col justify-between">
                    <div>
                      {megaMenuData.summaryTitle && (
                        <h3 className="text-2xl lg:text-3xl font-bold mb-4 text-white">
                          {megaMenuData.summaryTitle}
                        </h3>
                      )}
                      {megaMenuData.summaryText && (
                        <p className="text-sm lg:text-base text-white/90 leading-relaxed mb-6">
                          {megaMenuData.summaryText}
                        </p>
                      )}
                      <Link
                        to={href}
                        className="inline-flex items-center text-sm font-medium text-white/90 hover:text-white underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cyan-500 rounded"
                        role="menuitem"
                      >
                        View all {label}
                      </Link>
                    </div>
                    {megaMenuData.ctaLabel && megaMenuData.ctaHref && (
                      <div>
                        <Link
                          to={megaMenuData.ctaHref}
                          className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-cyan-600 shadow-lg hover:bg-white/90 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-cyan-500"
                          role="menuitem"
                        >
                          {megaMenuData.ctaLabel}
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Middle Panel: Categories List (Vertical) */}
                {megaMenuData.sections.length > 0 ? (
                  <>
                    <div className={cn(
                      "md:col-span-auto bg-white border-r border-border/50",
                      // Responsive borders
                      !(megaMenuData.summaryTitle || megaMenuData.summaryText) 
                        ? "md:rounded-tl-3xl md:rounded-bl-3xl rounded-tl-3xl rounded-tr-3xl md:rounded-tr-none"
                        : "md:rounded-none rounded-none",
                      // Mobile: add bottom border, desktop: right border only
                      "border-b md:border-b-0 md:border-r"
                    )}>
                      <div className="p-4 space-y-1 max-h-[500px] overflow-y-auto">
                        {!(megaMenuData.summaryTitle || megaMenuData.summaryText) && (
                          <Link
                            to={href}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                            role="menuitem"
                          >
                            View all {label}
                          </Link>
                        )}
                        {megaMenuData.sections.map((section, index) => {
                          const SectionIcon = section.icon || resolveIcon(section.iconName || undefined);
                          const isActive = index === selectedCategoryIndex;
                          return (
                            <React.Fragment key={section.title}>
                              {section.href ? (
                              <Link
                                to={section.href}
                                onMouseEnter={() => setSelectedCategoryIndex(index)}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all",
                                  isActive
                                    ? "bg-cyan-50 text-cyan-700 border-l-4 border-cyan-500"
                                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                )}
                                role="menuitem"
                              >
                                {SectionIcon && (
                                  <span className={cn(
                                    "flex-shrink-0",
                                    isActive ? "text-cyan-600" : "text-gray-600"
                                  )} aria-hidden="true">
                                    {React.createElement(SectionIcon, { className: "h-5 w-5" })}
                                  </span>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm font-medium truncate",
                                    isActive ? "text-cyan-700" : "text-gray-800"
                                  )}>
                                    {section.title}
                                  </p>
                                  {section.description && (
                                    <p className="text-xs text-gray-600 truncate mt-0.5">
                                      {section.description}
                                    </p>
                                  )}
                                </div>
                                {isActive && (
                                  <ChevronRight className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                                )}
                              </Link>
                            ) : (
                              <div
                                onMouseEnter={() => setSelectedCategoryIndex(index)}
                                onClick={() => setSelectedCategoryIndex(index)}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all",
                                  isActive
                                    ? "bg-cyan-50 text-cyan-700 border-l-4 border-cyan-500"
                                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                )}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedCategoryIndex(index);
                                  }
                                }}
                              >
                                {SectionIcon && (
                                  <span className={cn(
                                    "flex-shrink-0",
                                    isActive ? "text-cyan-600" : "text-gray-600"
                                  )} aria-hidden="true">
                                    {React.createElement(SectionIcon, { className: "h-5 w-5" })}
                                  </span>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm font-medium truncate",
                                    isActive ? "text-cyan-700" : "text-gray-800"
                                  )}>
                                    {section.title}
                                  </p>
                                  {section.description && (
                                    <p className="text-xs text-gray-600 truncate mt-0.5">
                                      {section.description}
                                    </p>
                                  )}
                                </div>
                                {isActive && (
                                  <ChevronRight className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                                )}
                              </div>
                            )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Panel: Sub-categories Grid */}
                    <div className={cn(
                      "bg-white p-6 lg:p-8 rounded-br-3xl rounded-bl-3xl md:rounded-bl-none",
                      // Mobile: show selected category title
                      "md:block"
                    )}>
                      {/* Mobile: Show category title */}
                      <div className="md:hidden mb-4 pb-3 border-b border-border/50">
                        <h4 className="text-sm font-semibold text-gray-800">
                          {megaMenuData.sections[selectedCategoryIndex]?.title}
                        </h4>
                      </div>
                      
                      {megaMenuData.sections[selectedCategoryIndex] && (
                        <div>
                          {megaMenuData.sections[selectedCategoryIndex].items && 
                           megaMenuData.sections[selectedCategoryIndex].items!.length > 0 ? (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                              {megaMenuData.sections[selectedCategoryIndex].items!.map((item) => {
                                const ItemIcon = item.icon || resolveIcon(item.iconName || undefined);
                                return (
                                  <Link
                                    key={item.title}
                                    to={item.href}
                                    className="group flex flex-col items-center text-center p-4 rounded-xl hover:bg-cyan-50/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                                    role="menuitem"
                                  >
                                    {ItemIcon && (
                                      <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 text-cyan-600 group-hover:from-cyan-200 group-hover:to-teal-200 group-hover:scale-110 transition-all duration-300 shadow-sm">
                                        {React.createElement(ItemIcon, { className: "h-8 w-8 lg:h-10 lg:w-10" })}
                                      </div>
                                    )}
                                    <p className="text-sm lg:text-base font-semibold text-gray-800 group-hover:text-cyan-700 transition-colors">
                                      {item.title}
                                    </p>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-12 text-gray-600">
                              <p className="text-sm">No items available in this category</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-600">
                    <p>No menu items available</p>
                  </div>
                )}
              </div>
            ) : (
              // Empty state - show simple link if no mega menu data
              <div className="p-6 lg:p-8">
                <div className="text-center text-gray-700">
                  <p className="text-sm mb-2">No menu items configured yet.</p>
                  <Link
                    to={href}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    role="menuitem"
                  >
                    Explore {label}
                  </Link>
                  <p className="text-xs mt-3 text-gray-600">Go to Admin → Menus to set up this mega menu.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
