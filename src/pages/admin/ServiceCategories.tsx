import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { BulkDeleteDialog } from '@/components/admin/BulkDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAdminList } from '@/hooks/useAdminList';
import { useBulkActions } from '@/hooks/useBulkActions';
import { getModuleConfig } from '@/config/adminModules';
import { syncCategoryToPage, syncServiceCategoriesFromPages, cleanupCategoryPage, migrateExistingToPages } from '@/lib/syncServicesToPages';
import { RefreshCw, LayoutGrid, List, ExternalLink, Pencil, Trash2, Briefcase, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';

type ServiceCategory = Tables<'service_categories'>;
type Service = Tables<'services'>;

export default function AdminServiceCategories() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSyncingFromPages, setIsSyncingFromPages] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<ServiceCategory | null>(null);
  const [hasServicesInCategory, setHasServicesInCategory] = useState<boolean | null>(null);
  const [servicesInCategory, setServicesInCategory] = useState<Pick<Service, 'id' | 'slug'> & { title?: string | null }[] | null>(null);
  const [pagesUnderCategory, setPagesUnderCategory] = useState<{ id: string; title: string; slug: string }[] | null>(null);
  const [isCheckingServices, setIsCheckingServices] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const checkCategoryHasServices = async (categoryId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);
    return !error && (count ?? 0) > 0;
  };

  const getServicesInCategory = async (categoryId: string): Promise<(Pick<Service, 'id' | 'slug'> & { title?: string | null })[]> => {
    const { data, error } = await supabase
      .from('services')
      .select('id, title, slug')
      .eq('category_id', categoryId)
      .order('display_order');
    if (error) return [];
    return (data ?? []) as (Pick<Service, 'id' | 'slug'> & { title?: string | null })[];
  };

  /** Get child pages under the category page (Pages & Navigation tree). */
  const getPagesUnderCategory = async (categoryId: string): Promise<{ id: string; title: string; slug: string }[]> => {
    const { data: categoryPage, error: pageErr } = await supabase
      .from('pages')
      .select('id')
      .eq('source_entity_type', 'service_category')
      .eq('source_entity_id', categoryId)
      .maybeSingle();
    if (pageErr || !categoryPage) return [];
    const { data: childPages, error: childErr } = await supabase
      .from('pages')
      .select('id, title, slug')
      .eq('parent_id', categoryPage.id)
      .order('display_order');
    if (childErr || !childPages) return [];
    return childPages as { id: string; title: string; slug: string }[];
  };

  // Categories with services for grouped view
  const { data: categoriesWithServices = [], isLoading: groupedLoading } = useQuery({
    queryKey: ['admin-service-categories-grouped'],
    queryFn: async () => {
      const { data: cats, error: catErr } = await supabase
        .from('service_categories')
        .select('*')
        .order('display_order');
      if (catErr) throw catErr;
      const { data: services, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .order('display_order');
      if (svcErr) throw svcErr;
      return (cats ?? []).map((cat: ServiceCategory) => ({
        ...cat,
        services: (services ?? []).filter((s: Service) => s.category_id === cat.id),
      }));
    },
  });

  // Sync categories FROM Pages when this page loads (Pages & Navigation is source of truth)
  useEffect(() => {
    syncServiceCategoriesFromPages(supabase).then(({ synced, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      if (synced > 0) {
        toast({ title: 'Synced from Pages', description: `${synced} categories synced from Pages & Navigation.` });
      }
      if (errors.length > 0) {
        toast({ title: 'Sync warnings', description: errors.slice(0, 2).join('; '), variant: 'destructive' });
      }
    });
  }, [queryClient, toast]);

  const moduleConfig = getModuleConfig('service-categories');
  const {
    data: categories = [],
    isLoading,
    searchQuery: listSearchQuery,
    setSearchQuery: setListSearchQuery,
    sortConfig,
    setSortConfig,
    filters,
    setFilter,
    clearFilters,
    page,
    totalPages,
    totalCount,
    pageSize,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
  } = useAdminList<ServiceCategory>({
    tableName: 'service_categories',
    queryKey: ['admin-service-categories'],
    searchFields: moduleConfig?.searchFields || ['name', 'slug'],
    defaultSort: moduleConfig?.defaultSort,
    pageSize: moduleConfig?.pageSize || 20,
  });

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredGrouped = searchLower
    ? categoriesWithServices
        .map((cat) => {
          const catMatches =
            (cat.name ?? '').toLowerCase().includes(searchLower) ||
            (cat.slug ?? '').toLowerCase().includes(searchLower) ||
            (cat.description ?? '').toLowerCase().includes(searchLower);
          const filteredServices = catMatches
            ? (cat.services as Service[])
            : (cat.services as Service[]).filter((s) => {
                const svc = s as { name?: string; slug?: string };
                return (
                  (svc.name ?? '').toLowerCase().includes(searchLower) ||
                  (svc.slug ?? '').toLowerCase().includes(searchLower)
                );
              });
          return { ...cat, services: filteredServices, catMatches };
        })
        .filter((cat) => cat.catMatches || (cat.services as Service[]).length > 0)
    : categoriesWithServices;

  const { bulkDelete, isPending: isBulkDeleting } = useBulkActions({
    tableName: 'service_categories',
    queryKey: ['admin-service-categories'],
    onSuccess: (action, count) => {
      toast({ title: `Deleted ${count} categories` });
      setSelectedIds([]);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (category: Partial<ServiceCategory>) => {
      let saved: ServiceCategory;
      if (editing) {
        const { data, error } = await supabase
          .from('service_categories')
          .update(category)
          .eq('id', editing.id)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('service_categories')
          .insert(category as Record<string, unknown>)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      }
      const syncResult = await syncCategoryToPage(supabase, saved, editing ? 'update' : 'create');
      if (!syncResult.success) {
        toast({ title: 'Page sync warning', description: syncResult.error, variant: 'destructive' });
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-tree'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      setOpen(false);
      setEditing(null);
      toast({ title: 'Category saved and synced to pages' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const category = categories.find((c) => c.id === id);
      const slug = category?.slug;
      const cleanupResult = await cleanupCategoryPage(supabase, id, slug);
      if (!cleanupResult.success) {
        toast({ title: 'Page cleanup warning', description: cleanupResult.error, variant: 'destructive' });
      }
      const { error } = await supabase.from('service_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-tree'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      setCategoryToDelete(null);
      toast({ title: 'Category deleted' });
    },
  });

  const itemsUnderCategoryWarningMessage =
    'First delete all services and pages listed below, then you will be able to delete this category.';

  const handleDeleteCategory = async (category: ServiceCategory) => {
    setIsCheckingServices(true);
    setHasServicesInCategory(null);
    setServicesInCategory(null);
    setPagesUnderCategory(null);
    setCategoryToDelete(null);
    try {
      const [servicesList, pagesList] = await Promise.all([
        getServicesInCategory(category.id),
        getPagesUnderCategory(category.id),
      ]);
      const hasItemsUnder = servicesList.length > 0 || pagesList.length > 0;
      setServicesInCategory(servicesList.length > 0 ? servicesList : null);
      setPagesUnderCategory(pagesList.length > 0 ? pagesList : null);
      setHasServicesInCategory(hasItemsUnder);
      setCategoryToDelete(category);
    } catch {
      toast({
        title: 'Error',
        description: 'Could not check items under this category.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingServices(false);
    }
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete && hasServicesInCategory === false) {
      deleteMutation.mutate(categoryToDelete.id);
      setCategoryToDelete(null);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    
    const name = form.get('name')?.toString() ?? '';
    const slug = form.get('slug')?.toString() ?? '';

    if (!name || !slug) {
      toast({ title: 'Validation Error', description: 'Name and slug are required', variant: 'destructive' });
      return;
    }

    const data: Partial<ServiceCategory> = {
      name,
      slug,
      description: form.get('description')?.toString() || null,
      icon: form.get('icon')?.toString() || null,
      display_order: Number(form.get('display_order')) || 0,
    };

    saveMutation.mutate(data);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      const [hasServices, pagesList] = await Promise.all([
        checkCategoryHasServices(id),
        getPagesUnderCategory(id),
      ]);
      if (hasServices || pagesList.length > 0) {
        const category = categories.find((c) => c.id === id);
        toast({
          title: 'Cannot delete categories',
          description: `"${category?.name ?? 'Category'}" and possibly others have services or pages. ${itemsUnderCategoryWarningMessage}`,
          variant: 'destructive',
        });
        setBulkDeleteOpen(false);
        return;
      }
    }
    for (const id of selectedIds) {
      const category = categories.find((c) => c.id === id);
      await cleanupCategoryPage(supabase, id, category?.slug);
    }
    const result = await bulkDelete(selectedIds);
    setBulkDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pages-tree'] });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
    if (result.failed > 0) {
      toast({
        title: 'Some deletions failed',
        description: `${result.success} deleted, ${result.failed} failed`,
        variant: 'destructive',
      });
    }
  };

  const handleSyncFromPages = async () => {
    setIsSyncingFromPages(true);
    try {
      const { synced, errors } = await syncServiceCategoriesFromPages(supabase);
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      if (errors.length > 0) {
        toast({
          title: synced > 0 ? 'Synced with warnings' : 'Sync warnings',
          description: errors.slice(0, 2).join('; '),
          variant: 'destructive',
        });
      }
      if (synced > 0) {
        toast({ title: 'Synced from Pages', description: `${synced} categories synced from Pages & Navigation.` });
      } else if (errors.length === 0) {
        toast({ title: 'Already in sync', description: 'Categories match Pages & Navigation.' });
      }
    } catch (e) {
      toast({
        title: 'Sync failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingFromPages(false);
    }
  };

  const handleMigrateExisting = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateExistingToPages(supabase);
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ queryKey: ['page-sections'] });
      const summary = `${result.categoriesSynced} categories, ${result.servicesSynced} services synced`;
      if (result.errors.length > 0) {
        toast({
          title: 'Migration completed with warnings',
          description: `${summary}. ${result.errors.slice(0, 2).join('; ')}`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Migration complete', description: summary });
      }
    } catch (e) {
      toast({
        title: 'Migration failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug' },
    { key: 'display_order', label: 'Order', sortable: true },
  ];

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Service Categories</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-4 -mt-2">
        Categories are driven by Pages &amp; Navigation: pages under &quot;Services&quot; become categories here. This page syncs from Pages when you open it. You can also add categories in Pages &amp; Navigation and click &quot;Sync from Pages&quot; below.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncFromPages}
          disabled={isSyncingFromPages}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingFromPages ? 'animate-spin' : ''}`} />
          {isSyncingFromPages ? 'Syncing…' : 'Sync from Pages'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMigrateExisting}
          disabled={isMigrating}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isMigrating ? 'animate-spin' : ''}`} />
          {isMigrating ? 'Migrating…' : 'Migrate existing to pages'}
        </Button>
      </div>

      <AdminToolbar
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setListSearchQuery(value);
        }}
        filters={moduleConfig?.filters || []}
        filterValues={filters}
        onFilterChange={setFilter}
        selectedCount={selectedIds.length}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        onAddNew={() => { setEditing(null); setOpen(true); }}
        addButtonLabel="Add Category"
        onClearFilters={() => {
          setSearchQuery('');
          setListSearchQuery('');
          clearFilters();
        }}
      />

      <div className="mt-6 flex items-center gap-2 mb-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grouped' | 'list')}>
          <TabsList className="h-9">
            <TabsTrigger value="grouped" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              By category (with services)
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        {viewMode === 'grouped' ? (
          groupedLoading ? (
            <div className="text-muted-foreground py-8 text-center">Loading categories…</div>
          ) : filteredGrouped.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              {searchQuery ? 'No categories or services match the search.' : 'No categories found. Add a category or sync from Pages & Navigation.'}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredGrouped.map((category) => (
                <Card key={category.id}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {category.name}
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Category</Badge>
                      </CardTitle>
                      {category.slug && (
                        <p className="text-sm text-muted-foreground">/{category.slug}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigate('/admin/pages', { state: { editCategoryId: category.id } });
                        }}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategory(category)}
                        disabled={isCheckingServices}
                        aria-label="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Link to="/admin/services" className="text-sm text-primary hover:underline flex items-center gap-1">
                        Services <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {(category.services as Service[]).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        <Link to="/admin/services" className="text-primary hover:underline">
                          Add services
                        </Link>
                      </p>
                    ) : (
                      <div className="divide-y">
                        {(category.services as Service[]).map((service) => (
                          <div
                            key={service.id}
                            className="flex items-center justify-between py-3 px-2 hover:bg-muted/50 rounded"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{(service as { name?: string }).name ?? '-'}</span>
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Service
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">/{service.slug}</p>
                            </div>
                            <Link
                              to="/admin/services"
                              className="text-sm text-primary hover:underline"
                            >
                              Edit in Services
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <>
            <AdminDataTable
              data={categories}
              columns={columns}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              sortConfig={sortConfig}
              onSortChange={(field, direction) => setSortConfig({ field, direction })}
              loading={isLoading}
              onEdit={(c) => {
                navigate('/admin/pages', { state: { editCategoryId: c.id } });
              }}
              onDelete={(c) => handleDeleteCategory(c)}
              emptyMessage="No categories found"
            />
            {totalPages > 1 && (
              <AdminPagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={goToPage}
                onPrevious={previousPage}
                onNext={nextPage}
                hasPreviousPage={hasPreviousPage}
                hasNextPage={hasNextPage}
              />
            )}
          </>
        )}
      </div>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedIds.length}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
        itemName="categories"
      />

      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryToDelete(null);
            setHasServicesInCategory(null);
            setServicesInCategory(null);
            setPagesUnderCategory(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-xl gap-5 p-6">
          <AlertDialogHeader className="space-y-1.5 text-left">
            <AlertDialogTitle className="text-xl">
              {hasServicesInCategory === true
                ? 'Cannot delete category'
                : hasServicesInCategory === false
                  ? 'Delete category?'
                  : 'Delete category?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                {hasServicesInCategory === null && (
                  <p className="text-muted-foreground text-sm">Checking for services and pages under this category…</p>
                )}
                {hasServicesInCategory === true && (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                      <p className="leading-relaxed">{itemsUnderCategoryWarningMessage}</p>
                    </div>
                    {servicesInCategory && servicesInCategory.length > 0 && (
                      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b bg-muted/40">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <Briefcase className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-semibold text-sm text-foreground">
                            Services ({servicesInCategory.length})
                          </span>
                        </div>
                        <ScrollArea className="h-[11rem]">
                          <ul className="divide-y divide-border">
                            {servicesInCategory.map((s) => (
                              <li
                                key={s.id}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm bg-background hover:bg-muted/30 transition-colors"
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                                <span className="font-medium text-foreground truncate">{s.title ?? s.slug}</span>
                                <span className="text-muted-foreground text-xs shrink-0">/{s.slug}</span>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}
                    {pagesUnderCategory && pagesUnderCategory.length > 0 && (
                      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b bg-muted/40">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-semibold text-sm text-foreground">
                            Pages ({pagesUnderCategory.length})
                          </span>
                        </div>
                        <ScrollArea className="h-[11rem]">
                          <ul className="divide-y divide-border">
                            {pagesUnderCategory.map((p) => (
                              <li
                                key={p.id}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm bg-background hover:bg-muted/30 transition-colors"
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                                <span className="font-medium text-foreground truncate">{p.title}</span>
                                <span className="text-muted-foreground text-xs shrink-0">/{p.slug}</span>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}
                  </>
                )}
                {hasServicesInCategory === false && categoryToDelete && (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Are you sure you want to delete &quot;{categoryToDelete.name}&quot;? This will remove it from Pages &amp; Navigation.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-2 pt-2">
            {hasServicesInCategory === true ? (
              <AlertDialogAction onClick={() => setCategoryToDelete(null)}>
                OK
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={confirmDeleteCategory}
                  disabled={hasServicesInCategory !== false || deleteMutation.isPending}
                >
                  Delete
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" defaultValue={editing?.name} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input name="slug" defaultValue={editing?.slug} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Input name="icon" defaultValue={editing?.icon ?? ''} maxLength={50} placeholder="e.g., Palette, Code" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editing?.description ?? ''} rows={3} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input name="display_order" type="number" defaultValue={editing?.display_order ?? 0} min={0} max={9999} />
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}