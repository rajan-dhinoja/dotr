import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { LayoutGrid, List, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { deleteSourceEntityWhenPageDeleted } from '@/lib/syncServicesToPages';

interface ServicePage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean | null;
  parent_id: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
}

interface CategoryPage {
  id: string;
  title: string;
  slug: string;
  display_order: number | null;
  services: ServicePage[];
}

interface ServicePageWithCategory extends ServicePage {
  categoryTitle: string;
}

export default function AdminServices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageToDelete, setPageToDelete] = useState<ServicePage | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>({
    field: 'display_order',
    direction: 'asc',
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: page, error: fetchErr } = await supabase
        .from('pages')
        .select('id, source_entity_type, source_entity_id, slug')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (page?.source_entity_type && page?.source_entity_id) {
        const r = await deleteSourceEntityWhenPageDeleted(supabase, page as { source_entity_type: string; source_entity_id: string; slug?: string });
        if (!r.success) throw new Error(r.error);
      } else {
        const { error } = await supabase.from('pages').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-pages-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['nav-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      setPageToDelete(null);
      toast({ title: 'Service page deleted' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    },
  });

  const handleEdit = (service: ServicePage) => {
    navigate('/admin/pages', { state: { editPageId: service.id } });
  };

  const { data: servicePagesGrouped = [], isLoading } = useQuery({
    queryKey: ['admin-service-pages-grouped'],
    queryFn: async () => {
      const { data: servicesRoot, error: rootErr } = await supabase
        .from('pages')
        .select('id')
        .eq('slug', 'services')
        .is('parent_id', null)
        .maybeSingle();
      if (rootErr || !servicesRoot) return [];

      const { data: categoryPages, error: catErr } = await supabase
        .from('pages')
        .select('id, title, slug, display_order')
        .eq('parent_id', servicesRoot.id)
        .eq('is_active', true)
        .order('display_order');
      if (catErr || !categoryPages) return [];

      const categoryIds = categoryPages.map((c) => c.id);
      if (categoryIds.length === 0) return [];

      const { data: servicePages, error: svcErr } = await supabase
        .from('pages')
        .select('id, title, slug, description, display_order, is_active, parent_id, source_entity_type, source_entity_id')
        .in('parent_id', categoryIds)
        .order('display_order');
      if (svcErr) return [];

      return categoryPages.map((cat) => ({
        ...cat,
        services: (servicePages ?? []).filter((s) => s.parent_id === cat.id) as ServicePage[],
      })) as CategoryPage[];
    },
  });

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredGrouped = useMemo(() => {
    if (!searchLower) return servicePagesGrouped;
    return servicePagesGrouped
      .map((cat) => {
        const catMatches = cat.title.toLowerCase().includes(searchLower) || (cat.slug ?? '').toLowerCase().includes(searchLower);
        const filteredServices = catMatches
          ? cat.services
          : cat.services.filter(
              (s) =>
                s.title?.toLowerCase().includes(searchLower) || (s.slug ?? '').toLowerCase().includes(searchLower)
            );
        return { ...cat, services: filteredServices };
      })
      .filter((cat) => cat.services.length > 0);
  }, [servicePagesGrouped, searchLower]);

  const flatServices = useMemo(() => {
    const items: ServicePageWithCategory[] = filteredGrouped.flatMap((cat) =>
      cat.services.map((s) => ({ ...s, categoryTitle: cat.title }))
    );
    if (!sortConfig) return items;
    return [...items].sort((a, b) => {
      const fa = (a as Record<string, unknown>)[sortConfig.field];
      const fb = (b as Record<string, unknown>)[sortConfig.field];
      if (fa == null && fb == null) return 0;
      if (fa == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (fb == null) return sortConfig.direction === 'asc' ? -1 : 1;
      const cmp = String(fa).localeCompare(String(fb), undefined, { numeric: true });
      return sortConfig.direction === 'desc' ? -cmp : cmp;
    });
  }, [filteredGrouped, sortConfig]);

  const columns = [
    { key: 'title', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug' },
    {
      key: 'categoryTitle',
      label: 'Category',
      render: (s: ServicePageWithCategory) => (
        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          {s.categoryTitle}
        </Badge>
      ),
    },
    { key: 'display_order', label: 'Order', sortable: true },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Service pages from Pages &amp; Navigation. Add or edit services in Pages &amp; Navigation.
        </p>
      </div>

      <AdminToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={[]}
        filterValues={{}}
        onFilterChange={() => {}}
        selectedCount={0}
        onAddNew={() => navigate('/admin/pages')}
        addButtonLabel="Add in Pages"
        onClearFilters={() => setSearchQuery('')}
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
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Loading service pages…</div>
        ) : viewMode === 'grouped' ? (
          filteredGrouped.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              {searchQuery ? 'No service pages match the search.' : 'No service pages found. Create service pages under category pages in Pages & Navigation.'}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredGrouped.map((category) => (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {category.title}
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Category
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">/{category.slug}</p>
                      </div>
                      <Link to="/admin/service-categories" className="text-sm text-primary hover:underline flex items-center gap-1">
                        Service Category <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {category.services.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No service pages in this category
                      </p>
                    ) : (
                      <div className="divide-y">
                        {category.services.map((service) => (
                          <div
                            key={service.id}
                            className="flex items-center justify-between py-3 px-2 hover:bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{service.title}</span>
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Service
                                  </Badge>
                                  {service.source_entity_type === 'service' && (
                                    <Badge variant="outline" className="text-xs">Linked</Badge>
                                  )}
                                  {!service.is_active && (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">Unpublished</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">/{service.slug}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Order: {service.display_order ?? 0}</span>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} aria-label="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPageToDelete(service)}
                                aria-label="Delete"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
          <AdminDataTable
            data={flatServices}
            columns={columns}
            selectedIds={[]}
            onSelectionChange={() => {}}
            sortConfig={sortConfig}
            onSortChange={(field, direction) => setSortConfig({ field, direction })}
            loading={false}
            onEdit={(item) => handleEdit(item)}
            onDelete={(item) => setPageToDelete(item)}
            emptyMessage={searchQuery ? 'No service pages match the search.' : 'No service pages found.'}
          />
        )}
      </div>

      <AlertDialog open={!!pageToDelete} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{pageToDelete?.title}&quot; from Pages &amp; Navigation.
              {pageToDelete?.source_entity_type === 'service' && ' The linked service record will also be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pageToDelete && deleteMutation.mutate(pageToDelete.id)}
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
