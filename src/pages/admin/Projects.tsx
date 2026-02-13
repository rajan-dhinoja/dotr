import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { BulkDeleteDialog } from '@/components/admin/BulkDeleteDialog';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { ProjectGalleryManager } from '@/components/admin/ProjectGalleryManager';
import { LazyEntityJsonEditor } from '@/components/admin/LazyEntityJsonEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { MenuItemsOrderList } from '@/components/admin/MenuItemsOrderList';
import type { AdminMenuItemNode } from '@/hooks/useAdminMenuItems';
import { useToast } from '@/hooks/use-toast';
import { useAdminList } from '@/hooks/useAdminList';
import { useBulkActions } from '@/hooks/useBulkActions';
import { getModuleConfig } from '@/config/adminModules';
import type { Tables } from '@/integrations/supabase/types';
import { Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Project = Tables<'projects'>;

const MENU_LOCATIONS = [
  { value: 'header', label: 'Header' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'footer', label: 'Footer' },
];

export default function AdminProjects() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [coverImage, setCoverImage] = useState<string>('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [jsonIsValid, setJsonIsValid] = useState(true);
  const [jsonData, setJsonData] = useState<Record<string, unknown>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [menuLocation, setMenuLocation] = useState<string>('header');
  const [menuItemsSearchQuery, setMenuItemsSearchQuery] = useState<string>('');
  const [menuItemToDelete, setMenuItemToDelete] = useState<AdminMenuItemNode | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const moduleConfig = getModuleConfig('projects');
  const {
    data: projects = [],
    isLoading,
    searchQuery,
    setSearchQuery,
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
  } = useAdminList<Project>({
    tableName: 'projects',
    queryKey: ['admin-projects'],
    searchFields: moduleConfig?.searchFields || ['name', 'slug'],
    defaultSort: moduleConfig?.defaultSort,
    pageSize: moduleConfig?.pageSize || 20,
  });

  const { bulkDelete, isPending: isBulkDeleting } = useBulkActions({
    tableName: 'projects',
    queryKey: ['admin-projects'],
    onSuccess: (action, count) => {
      toast({ title: `Deleted ${count} projects` });
      setSelectedIds([]);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (project: Partial<Project>) => {
      if (editing) {
        const { error } = await supabase.from('projects').update(project).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projects').insert(project as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setOpen(false);
      setEditing(null);
      setCoverImage('');
      setIsFeatured(false);
      toast({ title: editing ? 'Project updated' : 'Project created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      toast({ title: 'Project deleted' });
    },
  });

  const handleEdit = (project: Project) => {
    setEditing(project);
    setCoverImage(project.cover_image ?? '');
    setIsFeatured(project.is_featured ?? false);
    setJsonData({
      title: project.title || '',
      slug: project.slug || '',
      client: project.client || '',
      description: project.description || '',
      challenge: project.challenge || '',
      solution: project.solution || '',
      results: project.results || '',
      project_url: project.project_url || '',
      cover_image: project.cover_image || '',
      is_featured: project.is_featured || false,
      display_order: project.display_order || 0,
    });
    setActiveTab('details');
    setOpen(true);
  };

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

    // Use JSON data if JSON tab is active, otherwise use form data
    const data: Partial<Project> = activeTab === 'json' ? {
      title: (jsonData.title as string) || '',
      slug: (jsonData.slug as string) || '',
      client: (jsonData.client as string) || null,
      description: (jsonData.description as string) || null,
      challenge: (jsonData.challenge as string) || null,
      solution: (jsonData.solution as string) || null,
      results: (jsonData.results as string) || null,
      project_url: (jsonData.project_url as string) || null,
      cover_image: (jsonData.cover_image as string) || null,
      is_featured: (jsonData.is_featured as boolean) || false,
      display_order: Number(jsonData.display_order) || 0,
    } : (() => {
      const form = new FormData(e.currentTarget);
      const title = form.get('title')?.toString() ?? '';
      const slug = form.get('slug')?.toString() ?? '';

      if (!title || !slug) {
        toast({ title: 'Validation Error', description: 'Title and slug are required', variant: 'destructive' });
        return null;
      }

      return {
        title,
        slug,
        client: form.get('client')?.toString() || null,
        description: form.get('description')?.toString() || null,
        challenge: form.get('challenge')?.toString() || null,
        solution: form.get('solution')?.toString() || null,
        results: form.get('results')?.toString() || null,
        project_url: form.get('project_url')?.toString() || null,
        cover_image: coverImage || null,
        is_featured: isFeatured,
        display_order: Number(form.get('display_order')) || 0,
      };
    })();

    if (!data) return;

    saveMutation.mutate(data);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const result = await bulkDelete(selectedIds);
    setBulkDeleteOpen(false);
    if (result.failed > 0) {
      toast({
        title: 'Some deletions failed',
        description: `${result.success} deleted, ${result.failed} failed`,
        variant: 'destructive',
      });
    }
  };

  const handleEditPageFromMenu = async (pageId: string) => {
    navigate('/admin/pages', { state: { editPageId: pageId } });
  };

  const removeFromMenuMutation = useMutation({
    mutationFn: async (menuItemId: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', menuItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'admin-menu-items' });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
      setMenuItemToDelete(null);
      toast({ title: 'Removed from menu' });
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to remove', description: e.message, variant: 'destructive' }),
  });

  const handleRemoveFromMenu = (menuItemId: string, node?: AdminMenuItemNode) => {
    if (node) {
      setMenuItemToDelete(node);
    } else {
      removeFromMenuMutation.mutate(menuItemId);
    }
  };

  const confirmRemoveFromMenu = () => {
    if (menuItemToDelete) {
      removeFromMenuMutation.mutate(menuItemToDelete.id);
    }
  };

  // Combined filter function for portfolio type and search
  const portfolioMenuItemsFilterFn = useMemo(() => {
    return (node: AdminMenuItemNode): boolean => {
      // First check if it's a portfolio type
      if (node.page?.source_entity_type !== 'portfolio') return false;
      
      // Then apply search filter if there's a search query
      if (!menuItemsSearchQuery.trim()) return true;
      
      const searchLower = menuItemsSearchQuery.trim().toLowerCase();
      const labelMatch = node.label?.toLowerCase().includes(searchLower);
      const urlMatch = node.url?.toLowerCase().includes(searchLower);
      const pageTitleMatch = node.page?.title?.toLowerCase().includes(searchLower);
      const pageSlugMatch = node.page?.slug?.toLowerCase().includes(searchLower);
      
      return !!(labelMatch || urlMatch || pageTitleMatch || pageSlugMatch);
    };
  }, [menuItemsSearchQuery]);

  const columns = [
    {
      key: 'cover_image',
      label: 'Image',
      render: (p: Project) => p.cover_image ? (
        <img src={p.cover_image} alt="" className="h-10 w-16 object-cover rounded" />
      ) : '-',
    },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'client', label: 'Client' },
    { key: 'display_order', label: 'Order', sortable: true },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage portfolio projects and see how portfolio pages appear in your navigation.
        </p>
      </div>

      <AdminToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={moduleConfig?.filters || []}
        filterValues={filters}
        onFilterChange={setFilter}
        selectedCount={selectedIds.length}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        onAddNew={() => {
          setEditing(null);
          setCoverImage('');
          setIsFeatured(false);
          setJsonData({});
          setActiveTab('details');
          setOpen(true);
        }}
        addButtonLabel="Add Project"
        onClearFilters={clearFilters}
      />

      {projects.length > 0 && (
        <div className="mt-6">
          <AdminDataTable
            data={projects}
            columns={columns}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            sortConfig={sortConfig}
            onSortChange={(field, direction) => setSortConfig({ field, direction })}
            loading={isLoading}
            onEdit={handleEdit}
            onDelete={(p) => deleteMutation.mutate(p.id)}
            emptyMessage="No projects found"
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
        </div>
      )}

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedIds.length}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
        itemName="projects"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Project' : 'Add Project'}</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="gallery" disabled={!editing}>Gallery</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="title" defaultValue={editing?.title} required maxLength={200} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input name="slug" defaultValue={editing?.slug} required maxLength={100} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Input name="client" defaultValue={editing?.client ?? ''} maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea name="description" defaultValue={editing?.description ?? ''} rows={3} maxLength={10000} />
                </div>
                <div className="space-y-2">
                  <Label>Challenge</Label>
                  <Textarea name="challenge" defaultValue={editing?.challenge ?? ''} rows={2} maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label>Solution</Label>
                  <Textarea name="solution" defaultValue={editing?.solution ?? ''} rows={2} maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label>Results</Label>
                  <Textarea name="results" defaultValue={editing?.results ?? ''} rows={2} maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label>Project URL</Label>
                  <Input name="project_url" defaultValue={editing?.project_url ?? ''} type="url" />
                </div>
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <ImageUpload
                    bucket="project-images"
                    value={coverImage || undefined}
                    onChange={(url) => setCoverImage(url ?? '')}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_featured"
                    checked={isFeatured}
                    onCheckedChange={setIsFeatured}
                  />
                  <Label htmlFor="is_featured">Featured</Label>
                </div>
                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input name="display_order" type="number" defaultValue={editing?.display_order ?? 0} min={0} max={9999} />
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="gallery">
              {editing && <ProjectGalleryManager projectId={editing.id} />}
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              <LazyEntityJsonEditor
                entityType="project"
                entityId={editing?.id}
                value={jsonData}
                onChange={(value) => setJsonData(value)}
                onValidationChange={setJsonIsValid}
                fileName={editing?.title || 'project'}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Card className="mb-6 overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 text-primary/70" />
            <span>
              Portfolio pages show in this menu list with a <span className="font-semibold">Portfolio</span> type badge. Drag to reorder items per location.
            </span>
          </div>
        </div>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4">
            <Input
              placeholder="Search menu items..."
              value={menuItemsSearchQuery}
              onChange={(e) => setMenuItemsSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Tabs value={menuLocation} onValueChange={setMenuLocation} className="w-full">
            <TabsList className="bg-muted/60 mb-4">
              {MENU_LOCATIONS.map((loc) => (
                <TabsTrigger key={loc.value} value={loc.value}>
                  {loc.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {MENU_LOCATIONS.map((loc) => (
              <TabsContent key={loc.value} value={loc.value} className="mt-0">
                <MenuItemsOrderList
                  menuLocation={loc.value}
                  filterFn={portfolioMenuItemsFilterFn}
                  onEditPage={handleEditPageFromMenu}
                  onRemoveFromMenu={handleRemoveFromMenu}
                  onReorder={() => {
                    queryClient.invalidateQueries({
                      predicate: (q) =>
                        (q.queryKey[0] as string) === 'navigation-menu' ||
                        (q.queryKey[0] as string) === 'mega-menu',
                    });
                    toast({ title: 'Menu order updated' });
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!menuItemToDelete} onOpenChange={(open) => !open && setMenuItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{menuItemToDelete?.label}&quot; from the {menuLocation} menu? This will not delete the page itself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemoveFromMenu}
              disabled={removeFromMenuMutation.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
    </AdminLayout>
  );
}