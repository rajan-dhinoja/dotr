import React, { useState, useEffect, useMemo, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Moon, Sun, ChevronDown, ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/dotr-logo-light.jpg";
import logoDark from "@/assets/dotr-logo-dark.jpg";
import { useNavPages, Page } from "@/hooks/usePages";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { useNavigationMenu, NavigationTreeItem } from "@/hooks/useNavigationMenu";
import { getSystemRouteForSlug } from "@/lib/systemRoutes";
import { transformToMegaMenu } from "@/lib/menuUtils";
import { resolveIcon } from "@/lib/menuUtils";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface MegaMenuLink {
  title: string;
  href: string;
  description?: string;
  icon?: ReactNode;
}

interface MegaMenuSection {
  title: string;
  href?: string;
  description?: string;
  icon?: ReactNode;
  items?: MegaMenuLink[];
}

interface NavItem {
  name: string;
  href: string;
  slug?: string;
  description?: string | null;
  children?: NavItem[];
  sections?: MegaMenuSection[];
}

const SYSTEM_ROUTES: Record<string, string> = {
  home: "/",
  about: "/about",
  services: "/services",
  portfolio: "/portfolio",
  blog: "/blog",
  contact: "/contact",
  testimonials: "/testimonials",
  "privacy-policy": "/privacy-policy",
  "terms-of-service": "/terms-of-service",
};

function buildBaseHrefFromPage(item: NavigationTreeItem): string | null {
  if (!item.page_id || !(item as any).page) return null;
  const slug = (item as any).page.slug;
  return SYSTEM_ROUTES[slug] ?? `/${slug}`;
}

function normalizeAnchor(anchor: string | null | undefined): string | null {
  if (!anchor) return null;
  const trimmed = anchor.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function getItemHref(item: NavigationTreeItem): string {
  const rawUrl = item.url || "#";

  // If URL already contains a hash, respect it as-is
  if (rawUrl.includes("#")) {
    return rawUrl;
  }

  const sectionAnchor = normalizeAnchor((item as any).section_anchor as string | null | undefined);

  if (sectionAnchor) {
    const base =
      (rawUrl && rawUrl !== "#"
        ? rawUrl
        : buildBaseHrefFromPage(item)) ?? "/";
    return `${base}${sectionAnchor}`;
  }

  if ((!rawUrl || rawUrl === "#") && item.page_id && (item as any).page) {
    const baseFromPage = buildBaseHrefFromPage(item);
    if (baseFromPage) return baseFromPage;
  }

  return rawUrl || "#";
}

function treeToNavItem(node: NavigationTreeItem): NavItem {
  return {
    name: node.label,
    href: getItemHref(node),
    slug: (node as any).page?.slug,
    description: node.description,
    children: node.children?.length
      ? node.children.map(treeToNavItem)
      : undefined,
  };
}

function treeToNavItems(nodes: NavigationTreeItem[]): (NavItem & { menuItemId?: string; menuItem?: NavigationTreeItem })[] {
  return nodes.map((node) => {
    const nav = treeToNavItem(node);
    (nav as any).menuItemId = node.id;
    (nav as any).menuItem = node;
    return nav as NavItem & { menuItemId?: string; menuItem?: NavigationTreeItem };
  });
}

function collectPagesMap(items: NavigationTreeItem[]): Map<string, string> {
  const m = new Map<string, string>();
  function walk(n: NavigationTreeItem) {
    if (n.page_id && (n as any).page?.slug) {
      const slug = (n as any).page.slug;
      m.set(n.page_id, slug === "home" ? "" : slug);
    }
    n.children?.forEach(walk);
  }
  items.forEach(walk);
  return m;
}

// Always try to use database navigation first, fallback to pages if no menu items exist
export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openMobileDropdowns, setOpenMobileDropdowns] = useState<string[]>([]);
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const { data: pages = [], isLoading } = useNavPages();
  const { data: headerMenu = [], isLoading: menuLoading } = useNavigationMenu("header", { enabled: true });
  const { data: mobileMenu = [] } = useNavigationMenu("mobile", { enabled: true });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setOpenMobileDropdowns([]);
  }, [location.pathname]);

  // Build navigation tree from pages (legacy)
  const buildNavigationFromPages = (pages: Page[]): NavItem[] => {
    // Separate parent pages (no parent_id) and child pages
    const parentPages = pages.filter(p => !p.parent_id);
    const childPages = pages.filter(p => p.parent_id);

    return parentPages.map(parent => {
      const children: NavItem[] = childPages
        .filter(child => child.parent_id === parent.id)
        .map(child => ({
          name: child.title,
          href: getPageHref(child),
          slug: child.slug,
          description: child.description,
        }));

      return {
        name: parent.title,
        href: getPageHref(parent),
        slug: parent.slug,
        description: parent.description,
        children: children.length > 0 ? children : undefined,
      };
    });
  };

  // Get correct href based on page slug
  const getPageHref = (page: Page): string => getSystemRouteForSlug(page.slug);

  const navigationFromPages = buildNavigationFromPages(pages);

  // Desktop: use header menu from DB, else pages
  const navigationFromDb = headerMenu.length > 0 ? treeToNavItems(headerMenu) : null;
  const navigation =
    navigationFromDb && navigationFromDb.length > 0 ? navigationFromDb : navigationFromPages;

  // Mobile: prefer mobile menu from DB if it has items, else header, else pages
  const mobileNavTree = mobileMenu.length > 0 ? mobileMenu : headerMenu;
  const mobileNavFromDb = mobileNavTree.length > 0 ? treeToNavItems(mobileNavTree) : null;
  const mobileNavigation =
    mobileNavFromDb && mobileNavFromDb.length > 0 ? mobileNavFromDb : navigationFromPages;

  // Pages map for mega menu (mobile accordion); build from the tree used for mobile
  const mobilePagesMap = useMemo(
    () => collectPagesMap(mobileNavTree),
    [mobileNavTree]
  );

  const getPathFromHref = (href: string) => {
    const [path] = href.split("#");
    return path || "/";
  };

  const isActive = (href: string) => {
    const path = getPathFromHref(href);
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const toggleMobile = (key: string) => {
    setOpenMobileDropdowns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const isMobileOpen = (key: string) => openMobileDropdowns.includes(key);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        isScrolled
          ? "glass py-3 shadow-lg shadow-background/5"
          : "bg-transparent py-5"
      )}
    >
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center group"
          >
            <img 
              src={theme === "dark" ? logoDark : logoLight} 
              alt="DOTR - DHINOJA OmniTech Resolutions" 
              className="h-10 w-auto transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.length > 0 ? (
              navigation.map((item) => (
                <MegaMenu
                  key={item.name}
                  label={item.name}
                  href={item.href}
                  slug={item.slug}
                  menuItemId={(item as any).menuItemId}
                  menuItem={(item as any).menuItem}
                  isActive={isActive(item.href)}
                />
              ))
            ) : (
              !menuLoading && !isLoading && (
                <span className="text-sm text-muted-foreground">No menu items configured</span>
              )
            )}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <Button variant="gradient" size="default" className="rounded-xl group" asChild>
              <Link to="/contact">
                Get Started
                <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="rounded-xl"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300",
            isMenuOpen ? "max-h-[85vh] overflow-y-auto mt-4" : "max-h-0"
          )}
        >
          <div className="glass-card rounded-2xl p-4 space-y-2">
            {mobileNavigation.map((item) => {
              const menuItem = (item as any).menuItem as NavigationTreeItem | undefined;
              const isMega =
                menuItem &&
                (menuItem.menu_type === "mega" ||
                  (menuItem.children?.length &&
                    menuItem.children.some((c) => c.children?.length)));
              const megaDef =
                isMega && menuItem
                  ? transformToMegaMenu(menuItem as any, mobilePagesMap)
                  : null;
              const hasMegaSections = megaDef?.sections && megaDef.sections.length > 0;
              const hasChildren = item.children && item.children.length > 0;

              if (hasMegaSections) {
                // Mega menu: accordion with sections and items
                return (
                  <Collapsible
                    key={item.name}
                    open={isMobileOpen(item.name)}
                    onOpenChange={(o) =>
                      setOpenMobileDropdowns((prev) =>
                        o ? [...prev, item.name] : prev.filter((k) => k !== item.name)
                      )
                    }
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-xl text-foreground font-medium transition-colors",
                        isActive(item.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                      )}
                    >
                      <Link
                        to={item.href}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-l-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive(item.href) ? "text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleMobile(item.name)}
                        aria-expanded={isMobileOpen(item.name)}
                        aria-label={`Toggle ${item.name} submenu`}
                        className={cn(
                          "p-3 rounded-r-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive(item.href) ? "text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", isMobileOpen(item.name) && "rotate-180")}
                        />
                      </button>
                    </div>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      <Link
                        to={item.href}
                        className={cn(
                          "block px-4 py-2 rounded-xl text-foreground/80 font-medium",
                          isActive(item.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        View all {item.name}
                      </Link>
                      {megaDef!.sections.map((section) => {
                        const secKey = `${item.name}::${section.title}`;
                        const secOpen = isMobileOpen(secKey);
                        const hasItems = section.items && section.items.length > 0;
                        const SectionIcon = section.icon || resolveIcon(section.iconName);

                        if (hasItems) {
                          return (
                            <Collapsible
                              key={secKey}
                              open={secOpen}
                              onOpenChange={(o) =>
                                setOpenMobileDropdowns((prev) =>
                                  o ? [...prev, secKey] : prev.filter((k) => k !== secKey)
                                )
                              }
                            >
                              <div className="flex items-center justify-between rounded-xl text-foreground/80 font-medium">
                                {section.href ? (
                                  <Link
                                    to={section.href}
                                    className={cn(
                                      "flex-1 px-4 py-2 rounded-l-xl flex items-center gap-2",
                                      "hover:bg-muted/50"
                                    )}
                                  >
                                    {SectionIcon && <SectionIcon className="h-4 w-4" />}
                                    {section.title}
                                  </Link>
                                ) : (
                                  <span className="flex-1 px-4 py-2 flex items-center gap-2">
                                    {SectionIcon && <SectionIcon className="h-4 w-4" />}
                                    {section.title}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleMobile(secKey)}
                                  aria-expanded={secOpen}
                                  className="p-2 rounded-r-xl hover:bg-muted/50"
                                >
                                  <ChevronDown
                                    className={cn("h-4 w-4 transition-transform", secOpen && "rotate-180")}
                                  />
                                </button>
                              </div>
                              <CollapsibleContent className="pl-6 space-y-1 mt-1">
                                {section.href && (
                                  <Link
                                    to={section.href}
                                    className={cn(
                                      "block px-4 py-2 rounded-xl text-sm text-foreground/70",
                                      "hover:bg-muted/50"
                                    )}
                                  >
                                    View all {section.title}
                                  </Link>
                                )}
                                {section.items!.map((sub) => {
                                  const SubIcon = sub.icon || resolveIcon(sub.iconName);
                                  return (
                                    <Link
                                      key={sub.title}
                                      to={sub.href}
                                      className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-foreground/80",
                                        isActive(sub.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                                      )}
                                    >
                                      {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
                                      {sub.title}
                                    </Link>
                                  );
                                })}
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        }
                        if (section.href) {
                          return (
                            <Link
                              key={secKey}
                              to={section.href}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-foreground/80 font-medium",
                                isActive(section.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                              )}
                            >
                              {SectionIcon && <SectionIcon className="h-4 w-4" />}
                              {section.title}
                            </Link>
                          );
                        }
                        return null;
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              if (hasChildren) {
                // 2- or 3-level: expandable with optional nested
                return (
                  <Collapsible
                    key={item.name}
                    open={isMobileOpen(item.name)}
                    onOpenChange={(o) =>
                      setOpenMobileDropdowns((prev) =>
                        o ? [...prev, item.name] : prev.filter((k) => k !== item.name)
                      )
                    }
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-xl text-foreground font-medium transition-colors",
                        isActive(item.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                      )}
                    >
                      <Link
                        to={item.href}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-l-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive(item.href) ? "text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleMobile(item.name)}
                        aria-expanded={isMobileOpen(item.name)}
                        aria-label={`Toggle ${item.name} submenu`}
                        className={cn(
                          "p-3 rounded-r-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive(item.href) ? "text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", isMobileOpen(item.name) && "rotate-180")}
                        />
                      </button>
                    </div>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      <Link
                        to={item.href}
                        className={cn(
                          "block px-4 py-2 rounded-xl text-foreground/80 font-medium",
                          isActive(item.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        All {item.name}
                      </Link>
                      {item.children!.map((child) => {
                        const childHasSub = child.children && child.children.length > 0;
                        const childKey = `${item.name}::${child.name}`;
                        if (childHasSub) {
                          return (
                            <Collapsible
                              key={childKey}
                              open={isMobileOpen(childKey)}
                              onOpenChange={(o) =>
                                setOpenMobileDropdowns((prev) =>
                                  o ? [...prev, childKey] : prev.filter((k) => k !== childKey)
                                )
                              }
                            >
                              <div className="flex items-center justify-between rounded-xl text-foreground/80 font-medium">
                                <Link
                                  to={child.href}
                                  className={cn(
                                    "flex-1 px-4 py-2 rounded-l-xl",
                                    isActive(child.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                                  )}
                                >
                                  {child.name}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => toggleMobile(childKey)}
                                  aria-expanded={isMobileOpen(childKey)}
                                  className="p-2 rounded-r-xl hover:bg-muted/50"
                                >
                                  <ChevronDown
                                    className={cn("h-4 w-4 transition-transform", isMobileOpen(childKey) && "rotate-180")}
                                  />
                                </button>
                              </div>
                              <CollapsibleContent className="pl-6 space-y-1 mt-1">
                                {child.children!.map((gc) => (
                                  <Link
                                    key={gc.name}
                                    to={gc.href}
                                    className={cn(
                                      "block px-4 py-2 rounded-xl text-sm text-foreground/80",
                                      isActive(gc.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                                    )}
                                  >
                                    {gc.name}
                                  </Link>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        }
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={cn(
                              "block px-4 py-2 rounded-xl text-foreground/80 font-medium",
                              isActive(child.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                            )}
                          >
                            {child.name}
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "block px-4 py-3 rounded-xl text-foreground font-medium transition-colors",
                    isActive(item.href) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
            <Button className="w-full bg-gradient-primary hover:opacity-90 rounded-xl mt-2" asChild>
              <Link to="/contact">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
};
