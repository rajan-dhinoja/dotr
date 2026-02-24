import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { VisibilityToggle } from '@/components/admin/VisibilityToggle';
import { LazyEntityJsonEditor } from '@/components/admin/LazyEntityJsonEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { usePagesImportExport } from '@/hooks/usePagesImportExport';
import { useSyncPagesToMenu } from '@/hooks/useSyncPagesToMenu';
import { PagesImportModal } from '@/components/admin/PagesImportModal';
import { MenuItemsOrderList } from '@/components/admin/MenuItemsOrderList';
import { MenuFilterSortBar, type MenuItemKindFilter, type MenuSortOption } from '@/components/admin/MenuFilterSortBar';
import type { PageForNav } from '@/components/admin/PagesNavigationList';
import { useAdminMenuItems, type AdminMenuItemNode } from '@/hooks/useAdminMenuItems';
import type { TablesInsert } from '@/integrations/supabase/types';
import { getSystemRouteForSlug } from '@/lib/systemRoutes';
import { syncPageToCategory, syncPageToService, syncPageToServiceCategory, syncServiceCategoriesFromPages, deleteSourceEntityWhenPageDeleted } from '@/lib/syncServicesToPages';
import { Upload, Download, RefreshCw, Info, Plus, Link2, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminPageSections, type PageSection } from '@/hooks/usePageSections';

interface Page {
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
  // Navigation integration fields (hybrid model)
  show_in_navigation: boolean | null;
  default_menu_type: string | null;
  navigation_label_override: string | null;
  navigation_priority: number | null;
  // Source entity (linked to service or service_category)
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface SectionMenuLinkFormState {
  menuItemId?: string;
  menuLocation: string;
  pageId: string;
  sectionId: string;
  label: string;
  displayOrder: string;
  parentMenuItemId: string;
}

interface SectionMenuItemRow {
  id: string;
  label: string;
  menu_location: string;
  url: string | null;
  section_anchor: string | null;
  page_id: string | null;
  page?: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

interface SectionMenuParentRow {
  id: string;
  label: string;
  menu_location: string;
  page_id: string | null;
  section_anchor?: string | null;
  page?: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

const TEMPLATE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'blank', label: 'Blank' },
];

const PAGE_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'about', label: 'About' },
  { value: 'contact', label: 'Contact' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'blog', label: 'Blog' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'service_category', label: 'Service Category' },
  { value: 'service', label: 'Service' },
] as const;

type PageTypeValue = (typeof PAGE_TYPE_OPTIONS)[number]['value'];

const MENU_LOCATIONS = [
  { value: 'header', label: 'Header' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'footer', label: 'Footer' },
];

export default function AdminPages() {
  const location = useLocation();
  const navigate = useNavigate();
  const [syncLocation, setSyncLocation] = useState<string>('header');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [showInNav, setShowInNav] = useState(true);
  const [showInNavigation, setShowInNavigation] = useState(true);
  const [defaultMenuType, setDefaultMenuType] = useState<string>('header');
  const [navigationLabelOverride, setNavigationLabelOverride] = useState<string>('');
  const [navigationPriority, setNavigationPriority] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('general');
  const [jsonIsValid, setJsonIsValid] = useState(true);
  const [jsonContent, setJsonContent] = useState<Record<string, unknown>>({});
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);
  const [pageType, setPageType] = useState<PageTypeValue>('manual');
  const [sectionLinkDialogOpen, setSectionLinkDialogOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [menuItemKindFilter, setMenuItemKindFilter] = useState<MenuItemKindFilter>('all');
  const [menuPageTypeFilter, setMenuPageTypeFilter] = useState<string>('');
  const [menuSortBy, setMenuSortBy] = useState<MenuSortOption>('default');
  const [syncPageOrderOnReorder, setSyncPageOrderOnReorder] = useState(false);
  const [selectedMenuItemIds, setSelectedMenuItemIds] = useState<string[]>([]);
  const [isBulkDeletingPages, setIsBulkDeletingPages] = useState(false);
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const { exportPagesMenu } = usePagesImportExport();
  const queryClient = useQueryClient();
  const isFetchingMenuItems = useIsFetching({ queryKey: ['admin-menu-items', syncLocation] }) > 0;
  const syncPagesToMenuMutation = useSyncPagesToMenu();
  const { data: menuDataForSync } = useAdminMenuItems(syncLocation);
  const [sectionLinkForm, setSectionLinkForm] = useState<SectionMenuLinkFormState>({
    menuItemId: undefined,
    menuLocation: 'header',
    pageId: '',
    sectionId: '',
    label: '',
    displayOrder: '',
    parentMenuItemId: 'none',
  });

  // Ensure service categories stay in sync with Pages (children of Services page)
  useEffect(() => {
    syncServiceCategoriesFromPages(supabase).then(({ synced, errors }) => {
      if (synced > 0 || errors.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['service-categories'] });
        queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      }
    });
  }, [queryClient]);

  // Fetch all pages for hierarchical view (not paginated)
  const { data: allPagesForHierarchy = [] } = useQuery<Page[]>({
    queryKey: ['admin-pages-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Page[];
    },
  });

  const pageLevelByPageId = useMemo(() => {
    type Node = { id: string; parent_id: string | null; display_order: number | null; children: Node[] };
    const byId = new Map<string, Node>();
    allPagesForHierarchy.forEach((p) => {
      byId.set(p.id, { id: p.id, parent_id: p.parent_id, display_order: p.display_order, children: [] });
    });
    const roots: Node[] = [];
    byId.forEach((node) => {
      if (node.parent_id && byId.has(node.parent_id)) {
        const parent = byId.get(node.parent_id)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const assignLevel = (nodes: Node[], level: number): { id: string; level: number }[] => {
      const out: { id: string; level: number }[] = [];
      nodes.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      nodes.forEach((n) => {
        out.push({ id: n.id, level });
        out.push(...assignLevel(n.children, level + 1));
      });
      return out;
    };
    const flat = assignLevel(roots, 0);
    return flat.reduce<Record<string, number>>((acc, { id, level }) => {
      acc[id] = level;
      return acc;
    }, {});
  }, [allPagesForHierarchy]);

  const { data: sectionMenuItems = [], isLoading: sectionMenuItemsLoading } = useQuery<SectionMenuItemRow[]>({
    queryKey: ['admin-menu-items-section-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, label, menu_location, url, section_anchor, page_id, page:pages(id, title, slug)')
        .not('section_anchor', 'is', null)
        .order('menu_location', { ascending: true })
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SectionMenuItemRow[];
    },
  });

  const { data: possibleParents = [], isLoading: parentItemsLoading } = useQuery<SectionMenuParentRow[]>({
    queryKey: ['admin-menu-items-page-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, label, menu_location, page_id, section_anchor, page:pages(id, title, slug)')
        .order('menu_location', { ascending: true })
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SectionMenuParentRow[];
    },
  });

  const selectedPageForSections = allPagesForHierarchy.find((p) => p.id === sectionLinkForm.pageId) || null;
  const {
    data: adminSectionsResult,
  } = useAdminPageSections(selectedPageForSections?.slug || '', undefined);
  const adminSections = adminSectionsResult?.sections ?? [];

  const computeSectionAnchorId = (section: PageSection): string => {
    const content = (section.content || {}) as Record<string, unknown>;
    const rawAnchor = typeof content.anchor === 'string' ? content.anchor.trim() : '';
    if (rawAnchor) return rawAnchor;
    return `section-${section.id}`;
  };

  const deleteSectionMenuItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items-section-links'] });
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string) === 'navigation-menu' ||
          (q.queryKey[0] as string) === 'mega-menu',
      });
      toast({ title: 'Section link removed' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Failed to remove section link',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const createSectionMenuItemMutation = useMutation({
    mutationFn: async (payload: SectionMenuLinkFormState) => {
      const page = allPagesForHierarchy.find((p) => p.id === payload.pageId);
      if (!page) {
        throw new Error('Please select a page before creating a section link.');
      }

      const targetSection = adminSections.find((s) => s.id === payload.sectionId);
      if (!targetSection) {
        throw new Error('Please select a section to link to.');
      }

      const sectionAnchor = computeSectionAnchorId(targetSection);

      const basePath = getSystemRouteForSlug(page.slug);

      const parsedOrder = Number(payload.displayOrder);
      const normalizedDisplayOrder = Number.isFinite(parsedOrder)
        ? parsedOrder
        : page.display_order ?? 0;

      const label =
        payload.label.trim() ||
        targetSection.title ||
        targetSection.section_type.replace(/-/g, ' ');

      const updatePayload = {
        menu_location: payload.menuLocation,
        label,
        url: basePath,
        page_id: page.id,
        parent_id: payload.parentMenuItemId === 'none' ? null : payload.parentMenuItemId,
        display_order: normalizedDisplayOrder,
        section_anchor: sectionAnchor,
        section_id: targetSection.id,
      };

      if (payload.menuItemId) {
        // Update existing menu item
        const { error } = await supabase
          .from('menu_items')
          .update(updatePayload)
          .eq('id', payload.menuItemId);
        if (error) throw error;
      } else {
        // Create new menu item
        const insertPayload = {
          ...updatePayload,
          target: '_self',
          is_active: true,
          menu_type: 'simple' as string | null,
          description: null as string | null,
          icon_name: null as string | null,
          mega_summary_title: null as string | null,
          mega_summary_text: null as string | null,
          mega_cta_label: null as string | null,
          mega_cta_href: null as string | null,
        };
        const { error } = await supabase.from('menu_items').insert(insertPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSectionLinkForm({
        menuItemId: undefined,
        menuLocation: 'header',
        pageId: '',
        sectionId: '',
        label: '',
        displayOrder: '',
        parentMenuItemId: 'none',
      });
      setSectionLinkDialogOpen(false);
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string) === 'navigation-menu' ||
          (q.queryKey[0] as string) === 'mega-menu',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items-page-links'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items-section-links'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items', sectionLinkForm.menuLocation] });
      queryClient.invalidateQueries({
        predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu',
      });
      toast({
        title: sectionLinkForm.menuItemId ? 'Section link updated' : 'Section link created',
        description: 'Menu item now links directly to the selected section.',
      });
    },
    onError: (e: Error) => {
      toast({
        title: sectionLinkForm.menuItemId ? 'Failed to update section link' : 'Failed to create section link',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (page: Partial<Page>) => {
      // Only include fields that exist in the schema to avoid errors
      const safePage: Record<string, any> = {
        title: page.title,
        slug: page.slug,
        description: page.description,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        template: page.template,
        parent_id: page.parent_id,
        is_active: page.is_active,
        show_in_nav: page.show_in_nav,
        display_order: page.display_order,
        content: page.content,
      };
      
      // Only add navigation fields if they exist (check by trying to include them conditionally)
      if (page.show_in_navigation !== undefined) {
        safePage.show_in_navigation = page.show_in_navigation;
      }
      if (page.default_menu_type !== undefined) {
        safePage.default_menu_type = page.default_menu_type;
      }
      if (page.navigation_label_override !== undefined) {
        safePage.navigation_label_override = page.navigation_label_override;
      }
      if (page.navigation_priority !== undefined) {
        safePage.navigation_priority = page.navigation_priority;
      }
      if (page.source_entity_type !== undefined) {
        safePage.source_entity_type = page.source_entity_type ?? null;
      }
      if (page.source_entity_id !== undefined) {
        safePage.source_entity_id = page.source_entity_id ?? null;
      }

      const servicesRoot = await supabase.from('pages').select('id').eq('slug', 'services').maybeSingle();
      const servicesRootId = servicesRoot.data?.id ?? null;
      const formSourceType = page.source_entity_type ?? editing?.source_entity_type ?? null;
      const formSourceId = page.source_entity_id ?? editing?.source_entity_id ?? null;

      if (editing) {
        const { error } = await supabase.from('pages').update(safePage).eq('id', editing.id);
        if (error) throw error;

        const parentId = page.parent_id ?? editing.parent_id;
        if (parentId === servicesRootId) {
          const r = await syncPageToServiceCategory(supabase, {
            id: editing.id,
            title: page.title ?? editing.title,
            slug: page.slug ?? editing.slug,
            parent_id: parentId,
            display_order: page.display_order ?? editing.display_order,
            description: page.description ?? editing.description,
            source_entity_type: formSourceType,
            source_entity_id: formSourceId,
          });
          if (!r.success) toast({ title: 'Category sync warning', description: r.error, variant: 'destructive' });
        } else if (formSourceType && formSourceId) {
          const syncPayload = { source_entity_id: formSourceId, title: page.title, description: page.description, display_order: page.display_order };
          if (formSourceType === 'service_category') {
            const r = await syncPageToCategory(supabase, syncPayload);
            if (!r.success) toast({ title: 'Category sync warning', description: r.error, variant: 'destructive' });
          } else if (formSourceType === 'service') {
            const catSlug = (page.slug ?? editing.slug)?.startsWith('services/') ? (page.slug ?? editing.slug)!.split('/')[1] : undefined;
            const r = await syncPageToService(supabase, syncPayload, catSlug);
            if (!r.success) toast({ title: 'Service sync warning', description: r.error, variant: 'destructive' });
          }
        }
        return {};
      } else {
        const { data: inserted, error } = await supabase.from('pages').insert([safePage as any]).select().single();
        if (error) throw error;
        const newPage = inserted as Page;
        if (newPage?.parent_id === servicesRootId) {
          const r = await syncPageToServiceCategory(supabase, {
            id: newPage.id,
            title: newPage.title,
            slug: newPage.slug,
            parent_id: newPage.parent_id,
            display_order: newPage.display_order,
            description: newPage.description,
            source_entity_type: formSourceType,
            source_entity_id: formSourceId,
          });
          if (!r.success) toast({ title: 'Category sync warning', description: r.error, variant: 'destructive' });
        }
        return { createdPage: newPage };
      }
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'page' });
      logActivity({
        action: editing ? 'update' : 'create',
        entity_type: 'page',
        entity_id: editing?.id,
        entity_name: editing?.title,
      });
      setOpen(false);
      setEditing(null);
      setPageType('manual');
      toast({ title: editing ? 'Page updated' : 'Page created' });

      const createdPage = data?.createdPage as Page | undefined;
      if (createdPage && syncLocation) {
        const url = getSystemRouteForSlug(createdPage.slug);
        let parentMenuItemId: string | null = null;
        let itemLevel = 0;
        let displayOrder = 0;

        if (createdPage.parent_id) {
          const { data: parentMenuItem } = await supabase
            .from('menu_items')
            .select('id, item_level')
            .eq('menu_location', syncLocation)
            .eq('page_id', createdPage.parent_id)
            .maybeSingle();
          if (parentMenuItem?.id) {
            parentMenuItemId = parentMenuItem.id;
            itemLevel = (parentMenuItem.item_level ?? 0) + 1;
            const { data: lastSibling } = await supabase
              .from('menu_items')
              .select('display_order')
              .eq('menu_location', syncLocation)
              .eq('parent_id', parentMenuItemId)
              .order('display_order', { ascending: false })
              .limit(1)
              .maybeSingle();
            displayOrder = lastSibling?.display_order != null ? lastSibling.display_order + 1 : 0;
          }
        }

        if (parentMenuItemId === null) {
          const { data: existing } = await supabase
            .from('menu_items')
            .select('display_order')
            .eq('menu_location', syncLocation)
            .is('parent_id', null)
            .order('display_order', { ascending: false })
            .limit(1)
            .maybeSingle();
          displayOrder = existing?.display_order != null ? existing.display_order + 1 : 0;
        }

        const menuItem: TablesInsert<'menu_items'> = {
          menu_location: syncLocation,
          label: createdPage.navigation_label_override || createdPage.title,
          url: url || null,
          page_id: createdPage.id,
          parent_id: parentMenuItemId,
          target: '_self',
          is_active: createdPage.is_active ?? true,
          display_order: displayOrder,
          menu_type: 'simple',
          item_level: itemLevel,
          description: createdPage.description || null,
          icon_name: null,
          mega_summary_title: null,
          mega_summary_text: null,
          mega_cta_label: null,
          mega_cta_href: null,
        };
        await supabase.from('menu_items').insert(menuItem);
        queryClient.invalidateQueries({ queryKey: ['admin-menu-items', syncLocation] });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
      }
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deletePageById = async (id: string) => {
    const { data: page, error: fetchErr } = await supabase
      .from('pages')
      .select('id, source_entity_type, source_entity_id, slug')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (page?.source_entity_type && page?.source_entity_id) {
      const r = await deleteSourceEntityWhenPageDeleted(
        supabase,
        page as { source_entity_type: string; source_entity_id: string; slug?: string }
      );
      if (!r.success) throw new Error(r.error);
    } else {
      const { error } = await supabase.from('pages').delete().eq('id', id);
      if (error) throw error;
    }
  };

  const deleteMutation = useMutation({
    mutationFn: deletePageById,
    onSuccess: () => {
      setPageToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'page' });
      toast({ title: 'Page deleted' });
    },
    onError: (e: Error) =>
      toast({
        title: 'Cannot delete',
        description: e.message,
        variant: 'destructive',
      }),
  });

  const handleDeletePage = (p: Page) => {
    setPageToDelete(p);
  };

  const confirmDeletePage = () => {
    if (pageToDelete) {
      deleteMutation.mutate(pageToDelete.id);
      setPageToDelete(null);
    }
  };

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('pages').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'page' });
    },
  });

  const toggleNavMutation = useMutation({
    mutationFn: async ({ id, show_in_navigation }: { id: string; show_in_navigation: boolean }) => {
      const { error } = await supabase.from('pages').update({ show_in_navigation }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-for-nav'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'page' });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
    },
  });

  const reorderPagesMutation = useMutation({
    mutationFn: async (reorderedPages: PageForNav[]) => {
      const updates = reorderedPages.map((p, index) => ({
        id: p.id,
        parent_id: p.parent_id,
        display_order: index,
      }));
      
      // Update all pages in a transaction-like manner
      for (const update of updates) {
        const { error } = await supabase
          .from('pages')
          .update({ parent_id: update.parent_id, display_order: update.display_order })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'page' });
      toast({ title: 'Page order updated' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Failed to update page order',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const removeFromMenuMutation = useMutation({
    mutationFn: async (menuItemId: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', menuItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'admin-menu-items' });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
      toast({ title: 'Removed from menu' });
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to remove', description: e.message, variant: 'destructive' }),
  });

  const toggleMenuItemVisibilityMutation = useMutation({
    mutationFn: async ({ menuItemId, is_active }: { menuItemId: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active })
        .eq('id', menuItemId);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'admin-menu-items' });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
      toast({ title: is_active ? 'Shown in menu' : 'Hidden from menu' });
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to update visibility', description: e.message, variant: 'destructive' }),
  });

  const handleEditPageFromMenu = async (pageId: string) => {
    const { data, error } = await supabase.from('pages').select('*').eq('id', pageId).maybeSingle();
    if (error || !data) {
      toast({ title: 'Page not found', variant: 'destructive' });
      return;
    }
    handleEdit(data as Page);
  };

  const handleEditSectionLinkFromMenu = (item: AdminMenuItemNode) => {
    setSectionLinkForm({
      menuItemId: item.id,
      menuLocation: item.menu_location,
      pageId: item.page_id || '',
      sectionId: item.section_id || '',
      label: item.label || '',
      displayOrder: item.display_order != null ? String(item.display_order) : '',
      parentMenuItemId: item.parent_id ?? 'none',
    });
    setSectionLinkDialogOpen(true);
  };

  const syncMenuOrderToPages = useCallback(() => {
    const tree = menuDataForSync?.tree ?? [];
    const updates: PageForNav[] = [];
    const seenPageIds = new Set<string>();
    function walk(nodes: AdminMenuItemNode[], parentPageId: string | null) {
      nodes.forEach((node) => {
        if (node.page_id && !seenPageIds.has(node.page_id)) {
          seenPageIds.add(node.page_id);
          const page = allPagesForHierarchy.find((p) => p.id === node.page_id);
          updates.push({
            id: node.page_id,
            title: page?.title ?? '',
            slug: page?.slug ?? '',
            parent_id: parentPageId,
            is_active: page?.is_active ?? true,
            show_in_navigation: page?.show_in_navigation ?? true,
            navigation_label_override: page?.navigation_label_override ?? null,
            display_order: updates.length,
            source_entity_type: page?.source_entity_type ?? null,
            source_entity_id: page?.source_entity_id ?? null,
          });
        }
        walk(node.children, node.page_id ?? parentPageId);
      });
    }
    walk(tree, null);
    if (updates.length === 0) {
      toast({ title: 'No page links in menu', description: 'Add page links to the menu first.', variant: 'destructive' });
      return;
    }
    reorderPagesMutation.mutate(updates);
  }, [menuDataForSync?.tree, allPagesForHierarchy, reorderPagesMutation, toast]);

  const selectedPageIdsFromMenu = useMemo(() => {
    const tree = menuDataForSync?.tree ?? [];
    const selectedSet = new Set(selectedMenuItemIds);
    const pageIds = new Set<string>();

    const walk = (nodes: AdminMenuItemNode[]) => {
      nodes.forEach((node) => {
        if (selectedSet.has(node.id) && node.page_id) {
          pageIds.add(node.page_id);
        }
        if (node.children?.length) {
          walk(node.children);
        }
      });
    };

    walk(tree);
    return Array.from(pageIds);
  }, [menuDataForSync?.tree, selectedMenuItemIds]);

  const handleBulkDeletePagesFromSelection = async () => {
    if (selectedPageIdsFromMenu.length === 0) {
      toast({
        title: 'No pages to delete',
        description: 'Selected items do not contain any pages.',
        variant: 'destructive',
      });
      return;
    }

    setIsBulkDeletingPages(true);
    let successCount = 0;
    let failedCount = 0;

    for (const pageId of selectedPageIdsFromMenu) {
      try {
        await deletePageById(pageId);
        successCount++;
      } catch (e) {
        console.error(e);
        failedCount++;
      }
    }

    // Invalidate the same queries as the single delete mutation
    queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'page' });

    setSelectedMenuItemIds([]);
    setIsBulkDeletingPages(false);

    if (successCount > 0) {
      toast({
        title: `Deleted ${successCount} page${successCount === 1 ? '' : 's'}`,
      });
    }

    if (failedCount > 0) {
      toast({
        title: 'Some pages could not be deleted',
        description: `${failedCount} page${failedCount === 1 ? '' : 's'} failed to delete. They may still be referenced elsewhere.`,
        variant: 'destructive',
      });
    }
  };

  const menuFilterFn = useMemo(() => {
    const kind = menuItemKindFilter;
    const pageType = menuPageTypeFilter && menuPageTypeFilter !== 'all' ? menuPageTypeFilter : '';
    return (node: AdminMenuItemNode) => {
      const isSectionLink = !!(node.section_anchor ?? node.section_id);
      const isPageLink = !!node.page_id && !isSectionLink;
      if (kind === 'page_link' && !isPageLink) return false;
      if (kind === 'section_link' && !isSectionLink) return false;
      if (pageType && isPageLink) {
        const nodeType = node.page?.source_entity_type ?? null;
        if (pageType === '__null__') return nodeType == null;
        return nodeType === pageType;
      }
      return true;
    };
  }, [menuItemKindFilter, menuPageTypeFilter]);

  const handleEdit = (page: Page) => {
    setEditing(page);
    setIsActive(page.is_active ?? true);
    setShowInNav(page.show_in_nav ?? true);
    setShowInNavigation(page.show_in_navigation ?? true);
    setDefaultMenuType(page.default_menu_type ?? 'header');
    setNavigationLabelOverride(page.navigation_label_override ?? '');
    setNavigationPriority(page.navigation_priority ?? 0);
    setPageType((page.source_entity_type as PageTypeValue) ?? 'manual');
    setJsonContent((page.content as Record<string, unknown>) || {});
    setActiveTab('general');
    setOpen(true);
  };

  // Open edit dialog when navigated from Services / Service Categories (or elsewhere)
  useEffect(() => {
    const state = location.state as { editPageId?: string; editCategoryId?: string } | null;
    const editPageId = state?.editPageId;
    const editCategoryId = state?.editCategoryId;
    if (!editPageId && !editCategoryId) return;

    let cancelled = false;
    (async () => {
      let page: Page | null = null;

      if (editPageId) {
        const { data, error } = await supabase
          .from('pages')
          .select('*')
          .eq('id', editPageId)
          .maybeSingle();
        if (!error && data) {
          page = data as Page;
        }
      } else if (editCategoryId) {
        const { data, error } = await supabase
          .from('pages')
          .select('*')
          .eq('source_entity_type', 'service_category')
          .eq('source_entity_id', editCategoryId)
          .maybeSingle();
        if (!error && data) {
          page = data as Page;
        }
      }

      if (cancelled || !page) {
        navigate(location.pathname, { replace: true, state: {} });
        return;
      }

      handleEdit(page);
      navigate(location.pathname, { replace: true, state: {} });
    })();
    return () => { cancelled = true; };
  }, [location.state, location.pathname, navigate]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // If JSON view is active and invalid, prevent save
    if (activeTab === 'json' && !jsonIsValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix JSON validation errors before saving',
        variant: 'destructive',
      });
      return;
    }

    const form = new FormData(e.currentTarget);
    
    const title = form.get('title')?.toString() ?? '';
    const slug = form.get('slug')?.toString() ?? '';

    if (!title || !slug) {
      toast({ title: 'Validation Error', description: 'Title and slug are required', variant: 'destructive' });
      return;
    }

    const sourceEntityType =
      pageType === 'manual'
        ? null
        : pageType === 'service_category'
          ? 'service_category'
          : pageType === 'service'
            ? 'service'
            : pageType;
    const sourceEntityId = null;

    const data: Partial<Page> = {
      title,
      slug,
      description: form.get('description')?.toString() || null,
      meta_title: form.get('meta_title')?.toString() || null,
      meta_description: form.get('meta_description')?.toString() || null,
      template: form.get('template')?.toString() || 'default',
      parent_id: form.get('parent_id')?.toString() === 'none' ? null : form.get('parent_id')?.toString() || null,
      is_active: isActive,
      show_in_nav: showInNav,
      show_in_navigation: showInNavigation,
      default_menu_type: form.get('default_menu_type')?.toString() || defaultMenuType || null,
      navigation_label_override: form.get('navigation_label_override')?.toString() || navigationLabelOverride || null,
      navigation_priority: Number(form.get('navigation_priority')) || navigationPriority || 0,
      display_order: Number(form.get('display_order')) || 0,
      content: activeTab === 'json' ? jsonContent : (editing?.content || {}),
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
    };

    saveMutation.mutate(data);
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pages &amp; Navigation</h1>
          <p className="text-muted-foreground">
            One list per menu location. Use the tabs to switch Header, Mobile, or Footer. Add pages and section links, then drag to reorder and nest. Use &quot;Sync menu order to pages&quot; or enable &quot;Sync to pages on reorder&quot; to update the page hierarchy from the menu order.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Sync Pages to Menu</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Push page order and “In nav” pages to the selected menu location.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Tabs value={syncLocation} onValueChange={setSyncLocation} className="w-auto">
                <TabsList className="bg-muted/60">
                  {MENU_LOCATIONS.map((loc) => (
                    <TabsTrigger key={loc.value} value={loc.value}>
                      {loc.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                variant="default"
                onClick={() => syncPagesToMenuMutation.mutate(syncLocation)}
                disabled={syncPagesToMenuMutation.isPending}
                className="shadow-sm"
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', syncPagesToMenuMutation.isPending && 'animate-spin')} />
                {syncPagesToMenuMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setEditing(null);
              setIsActive(true);
              setShowInNav(true);
              setShowInNavigation(true);
              setDefaultMenuType('header');
              setNavigationLabelOverride('');
              setNavigationPriority(0);
              setPageType('manual');
              setJsonContent({});
              setActiveTab('general');
              setOpen(true);
            }}
            className="gap-2 h-10"
          >
            <Plus className="h-4 w-4" />
            Add Page
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setSectionLinkForm({
                menuItemId: undefined,
                menuLocation: 'header',
                pageId: '',
                sectionId: '',
                label: '',
                displayOrder: '',
                parentMenuItemId: 'none',
              });
              setSectionLinkDialogOpen(true);
            }} 
            className="gap-2 h-10"
          >
            <Link2 className="h-4 w-4" />
            Add Section Link
          </Button>
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="gap-2 h-10">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" onClick={() => exportPagesMenu()} className="gap-2 h-10">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>

        <PagesImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />

        <Card className="overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0 text-primary/70" />
              <span>
                Menu for this location. Drag to reorder; drop on a gap for same level, or on a card to nest. Use &quot;Sync menu order to pages&quot; to update the page tree. Edit page, manage sections, or remove from menu per item.
              </span>
            </div>
          </div>
          <CardContent className="p-4 sm:p-6">
            <Tabs value={syncLocation} onValueChange={(v) => { setSyncLocation(v); setSelectedMenuItemIds([]); }} className="w-full">
              <div className="flex items-center justify-between gap-2 mb-4">
                <TabsList className="bg-muted/60">
                  {MENU_LOCATIONS.map((loc) => (
                    <TabsTrigger key={loc.value} value={loc.value}>
                      {loc.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    queryClient.refetchQueries({ queryKey: ['admin-menu-items', syncLocation] }).then(() => {
                      toast({ title: 'Menu list refreshed' });
                    }).catch(() => {
                      toast({ title: 'Refresh failed', variant: 'destructive' });
                    });
                  }}
                  title="Refresh menu items list"
                  className="flex-shrink-0"
                  disabled={isFetchingMenuItems}
                >
                  <RefreshCw className={cn('h-4 w-4', isFetchingMenuItems && 'animate-spin')} />
                </Button>
              </div>
              <div className="mb-4 space-y-3">
                <MenuFilterSortBar
                  searchQuery={menuSearchQuery}
                  onSearchChange={setMenuSearchQuery}
                  itemKind={menuItemKindFilter}
                  onItemKindChange={setMenuItemKindFilter}
                  pageTypeFilter={menuPageTypeFilter}
                  onPageTypeFilterChange={setMenuPageTypeFilter}
                  sortBy={menuSortBy}
                  onSortByChange={setMenuSortBy}
                  onClearAll={() => {
                    setMenuSearchQuery('');
                    setMenuItemKindFilter('all');
                    setMenuPageTypeFilter('');
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="sync-page-order-on-reorder"
                      checked={syncPageOrderOnReorder}
                      onCheckedChange={setSyncPageOrderOnReorder}
                    />
                    <Label htmlFor="sync-page-order-on-reorder" className="text-sm font-normal cursor-pointer">
                      Sync to pages on reorder
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncMenuOrderToPages}
                    disabled={!menuDataForSync?.tree?.length || reorderPagesMutation.isPending}
                    title="Apply current menu order and nesting to the pages table"
                  >
                    {reorderPagesMutation.isPending ? 'Syncing...' : 'Sync menu order to pages'}
                  </Button>
                  {selectedMenuItemIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{selectedMenuItemIds.length} selected</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          selectedMenuItemIds.forEach((id) => removeFromMenuMutation.mutate(id));
                          setSelectedMenuItemIds([]);
                        }}
                        disabled={removeFromMenuMutation.isPending}
                      >
                        Remove from menu
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          selectedMenuItemIds.forEach((id) =>
                            toggleMenuItemVisibilityMutation.mutate({ menuItemId: id, is_active: false })
                          );
                          setSelectedMenuItemIds([]);
                        }}
                        disabled={toggleMenuItemVisibilityMutation.isPending}
                      >
                        Hide in menu
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDeletePagesFromSelection}
                        disabled={isBulkDeletingPages || selectedPageIdsFromMenu.length === 0}
                      >
                        {isBulkDeletingPages ? 'Deleting pages...' : 'Delete pages'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedMenuItemIds([])}>
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {MENU_LOCATIONS.map((loc) => (
                <TabsContent key={loc.value} value={loc.value} className="mt-0">
                  <MenuItemsOrderList
                    menuLocation={loc.value}
                    searchQuery={menuSearchQuery}
                    filterFn={menuFilterFn}
                    sortBy={menuSortBy}
                    onAfterReorder={syncPageOrderOnReorder ? syncMenuOrderToPages : undefined}
                    onEditPage={handleEditPageFromMenu}
                    onEditSectionLink={handleEditSectionLinkFromMenu}
                    onRemoveFromMenu={(id) => removeFromMenuMutation.mutate(id)}
                    onToggleVisibility={(menuItemId, is_active) =>
                      toggleMenuItemVisibilityMutation.mutate({ menuItemId, is_active })
                    }
                    isVisibilityPending={toggleMenuItemVisibilityMutation.isPending}
                    onTogglePageVisibility={(id, is_active) => toggleVisibilityMutation.mutate({ id, is_active })}
                    isPageVisibilityPending={toggleVisibilityMutation.isPending}
                    onTogglePageInNav={(id, show_in_navigation) => toggleNavMutation.mutate({ id, show_in_navigation })}
                    isPageNavPending={toggleNavMutation.isPending}
                    onDeletePage={(pageId) => {
                      const full = allPagesForHierarchy.find((p) => p.id === pageId);
                      if (full) handleDeletePage(full);
                    }}
                    selectedIds={selectedMenuItemIds}
                    onSelectionChange={setSelectedMenuItemIds}
                    pageLevelByPageId={pageLevelByPageId}
                    onReorder={() => {
                      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
                      toast({ title: 'Menu order updated' });
                    }}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        </div>

      <Dialog 
        open={sectionLinkDialogOpen} 
        onOpenChange={(open) => {
          setSectionLinkDialogOpen(open);
          if (!open) {
            // Reset form when closing
            setSectionLinkForm({
              menuItemId: undefined,
              menuLocation: 'header',
              pageId: '',
              sectionId: '',
              label: '',
              displayOrder: '',
              parentMenuItemId: 'none',
            });
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sectionLinkForm.menuItemId ? 'Edit Section Menu Link' : 'Add Section Menu Link'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSectionMenuItemMutation.mutate(sectionLinkForm);
            }}
            className="space-y-4 mt-2"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="section-menu-location">Menu location</Label>
                <Select
                  value={sectionLinkForm.menuLocation}
                  onValueChange={(value) =>
                    setSectionLinkForm((prev) => ({ ...prev, menuLocation: value }))
                  }
                >
                  <SelectTrigger id="section-menu-location">
                    <SelectValue placeholder="Choose menu" />
                  </SelectTrigger>
                  <SelectContent>
                    {MENU_LOCATIONS.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section-menu-order">Menu order</Label>
                <Input
                  id="section-menu-order"
                  type="number"
                  min={0}
                  max={9999}
                  value={sectionLinkForm.displayOrder}
                  onChange={(e) =>
                    setSectionLinkForm((prev) => ({ ...prev, displayOrder: e.target.value }))
                  }
                  placeholder="Defaults to page order"
                />
                <p className="text-[11px] text-muted-foreground">
                  Lower numbers appear earlier in the selected menu.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="section-menu-page">Page</Label>
                <Select
                  value={sectionLinkForm.pageId}
                  onValueChange={(value) =>
                    setSectionLinkForm((prev) => ({
                      ...prev,
                      pageId: value,
                      sectionId: '',
                      parentMenuItemId: 'none',
                    }))
                  }
                >
                  <SelectTrigger id="section-menu-page">
                    <SelectValue placeholder="Choose page" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPagesForHierarchy.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Sections are loaded from the selected page&apos;s content.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section-menu-section">Section</Label>
                <Select
                  value={sectionLinkForm.sectionId}
                  onValueChange={(value) =>
                    setSectionLinkForm((prev) => ({ ...prev, sectionId: value }))
                  }
                  disabled={!selectedPageForSections || adminSections.length === 0}
                >
                  <SelectTrigger id="section-menu-section">
                    <SelectValue
                      placeholder={
                        !selectedPageForSections
                          ? 'Select a page first'
                          : adminSections.length === 0
                          ? 'No sections for this page'
                          : 'Choose section'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {adminSections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title || s.section_type}{' '}
                        <span className="text-xs text-muted-foreground">
                          ({computeSectionAnchorId(s)})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-menu-label">Menu label (optional)</Label>
              <Input
                id="section-menu-label"
                placeholder="Defaults to section title"
                value={sectionLinkForm.label}
                onChange={(e) =>
                  setSectionLinkForm((prev) => ({ ...prev, label: e.target.value }))
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-parent-menu-item">
                Parent menu item (optional)
              </Label>
              <Select
                value={sectionLinkForm.parentMenuItemId}
                onValueChange={(value) =>
                  setSectionLinkForm((prev) => ({ ...prev, parentMenuItemId: value }))
                }
                disabled={parentItemsLoading}
              >
                <SelectTrigger id="section-parent-menu-item">
                  <SelectValue placeholder="None (top level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">None (top level)</span>
                      <span className="text-[11px] text-muted-foreground">
                        Shows as a standalone link in the {sectionLinkForm.menuLocation} menu
                      </span>
                    </div>
                  </SelectItem>
                  {possibleParents
                    .filter((item) => item.menu_location === sectionLinkForm.menuLocation)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{item.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {item.section_anchor
                              ? `Section link · ${item.page?.title ?? 'Unknown page'}`
                              : item.page?.title ?? 'Unknown page'}
                            {item.page?.slug &&
                              ` · ${item.page.slug === 'home' ? '/' : `/${item.page.slug}`}`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Pick a parent to show this section link nested under a page menu item.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  !sectionLinkForm.pageId ||
                  !sectionLinkForm.sectionId ||
                  createSectionMenuItemMutation.isPending
                }
                className="gap-2"
              >
                {createSectionMenuItemMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {sectionLinkForm.menuItemId ? 'Updating link...' : 'Creating link...'}
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    {sectionLinkForm.menuItemId ? 'Update menu link' : 'Create menu link'}
                  </>
                )}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Page' : 'Add Page'}</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSubmit}>
              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input name="title" defaultValue={editing?.title} required maxLength={200} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    <Input 
                      name="slug" 
                      defaultValue={editing?.slug} 
                      required 
                      maxLength={100}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={pageType}
                      onValueChange={(value: PageTypeValue) => {
                        setPageType(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Manual = standalone. Other types are semantic tags so you can build experiences (e.g. service pages, about page) around them.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select name="template" defaultValue={editing?.template || 'default'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Page</Label>
                    <Select name="parent_id" defaultValue={editing?.parent_id || 'none'}>
                      <SelectTrigger>
                        <SelectValue placeholder="None (top level)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">None (top level)</span>
                            <span className="text-[11px] text-muted-foreground">
                              Appears as a primary page in navigation
                            </span>
                          </div>
                        </SelectItem>
                        {allPagesForHierarchy
                          .filter((p) => p.id !== editing?.id)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{p.title}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {p.slug === 'home' ? '/' : `/${p.slug}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea name="description" defaultValue={editing?.description ?? ''} rows={3} maxLength={1000} />
                </div>

                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input name="display_order" type="number" defaultValue={editing?.display_order ?? 0} min={0} max={9999} />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2">
                      <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
                      <Label htmlFor="is_active">Published</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="show_in_nav" checked={showInNav} onCheckedChange={setShowInNav} />
                      <Label htmlFor="show_in_nav">Show in Legacy Navigation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show_in_navigation"
                        checked={showInNavigation}
                        onCheckedChange={setShowInNavigation}
                      />
                      <Label htmlFor="show_in_navigation">Show in New Navigation</Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default Menu Type</Label>
                      <Select
                        name="default_menu_type"
                        defaultValue={editing?.default_menu_type || defaultMenuType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select menu type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="header">Header</SelectItem>
                          <SelectItem value="footer">Footer</SelectItem>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Navigation Label Override</Label>
                      <Input
                        name="navigation_label_override"
                        defaultValue={editing?.navigation_label_override ?? navigationLabelOverride}
                        placeholder="Optional label used in menus"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Navigation Priority</Label>
                    <Input
                      name="navigation_priority"
                      type="number"
                      defaultValue={editing?.navigation_priority ?? navigationPriority ?? 0}
                      min={0}
                      max={9999}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower numbers appear earlier in navigation within the same group.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="seo" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Meta Title</Label>
                  <Input name="meta_title" defaultValue={editing?.meta_title ?? ''} maxLength={60} placeholder="SEO title (max 60 chars)" />
                </div>
                <div className="space-y-2">
                  <Label>Meta Description</Label>
                  <Textarea name="meta_description" defaultValue={editing?.meta_description ?? ''} rows={3} maxLength={160} placeholder="SEO description (max 160 chars)" />
                </div>
              </TabsContent>

              <TabsContent value="json" className="mt-4">
                <LazyEntityJsonEditor
                  entityType="page"
                  entityId={editing?.id}
                  value={jsonContent}
                  onChange={(value) => setJsonContent(value)}
                  onValidationChange={setJsonIsValid}
                  fileName={editing?.title || 'page'}
                />
              </TabsContent>

              <div className="mt-6">
                <Button type="submit" className="w-full" disabled={saveMutation.isPending || (activeTab === 'json' && !jsonIsValid)}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pageToDelete} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pageToDelete?.title}&quot;? This will remove it from Pages &amp; Navigation.
              {pageToDelete?.source_entity_type === 'service_category' && (
                <span className="block mt-2 text-destructive">
                  If this is a service category that still has services, the delete will be blocked and you will see a warning.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeletePage}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
