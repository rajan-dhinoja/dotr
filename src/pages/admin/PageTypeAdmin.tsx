import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MenuItemsOrderList } from '@/components/admin/MenuItemsOrderList';
import { getTypeBadgeLabel, getTypeBadgeColor } from '@/components/admin/PagesNavigationList';
import type { AdminMenuItemNode } from '@/hooks/useAdminMenuItems';
import { useToast } from '@/hooks/use-toast';
import { Info, Pencil, LayoutGrid, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

const MENU_LOCATIONS = [
  { value: 'header', label: 'Header' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'footer', label: 'Footer' },
];

interface PageRecord {
  id: string;
  title: string;
  slug: string;
  source_entity_type: string | null;
  display_order: number | null;
  is_active: boolean | null;
  show_in_navigation: boolean | null;
}

interface PageTypeAdminProps {
  pageType: 'about' | 'contact' | 'blog';
  typeLabel: string;
  description: string;
}

export function PageTypeAdmin({ pageType, typeLabel, description }: PageTypeAdminProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [menuLocation, setMenuLocation] = useState('header');
  const [menuItemsSearchQuery, setMenuItemsSearchQuery] = useState('');
  const [menuItemToDelete, setMenuItemToDelete] = useState<AdminMenuItemNode | null>(null);
  const [pageToDelete, setPageToDelete] = useState<PageRecord | null>(null);

  const { data: pages = [], isLoading } = useQuery<PageRecord[]>({
    queryKey: ['admin-pages-by-type', pageType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pages')
        .select('id, title, slug, source_entity_type, display_order, is_active, show_in_navigation')
        .eq('source_entity_type', pageType)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PageRecord[];
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages-by-type', pageType] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pages-all'] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
      setPageToDelete(null);
      toast({ title: 'Page deleted' });
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' }),
  });

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

  const toggleMenuItemVisibilityMutation = useMutation({
    mutationFn: async ({ menuItemId, is_active }: { menuItemId: string; is_active: boolean }) => {
      const { error } = await supabase.from('menu_items').update({ is_active }).eq('id', menuItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'admin-menu-items' });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'navigation-menu' || (q.queryKey[0] as string) === 'mega-menu' });
    },
  });

  const handleEditPageFromMenu = (pageId: string) => {
    navigate('/admin/pages', { state: { editPageId: pageId } });
  };

  const handleRemoveFromMenu = (menuItemId: string, node?: AdminMenuItemNode) => {
    if (node) setMenuItemToDelete(node);
    else removeFromMenuMutation.mutate(menuItemId);
  };

  const confirmRemoveFromMenu = () => {
    if (menuItemToDelete) removeFromMenuMutation.mutate(menuItemToDelete.id);
  };

  const menuItemsFilterFn = useMemo(
    () => (node: AdminMenuItemNode): boolean => {
      if (node.page?.source_entity_type !== pageType) return false;
      if (!menuItemsSearchQuery.trim()) return true;
      const q = menuItemsSearchQuery.trim().toLowerCase();
      return !!(
        node.label?.toLowerCase().includes(q) ||
        node.url?.toLowerCase().includes(q) ||
        node.page?.title?.toLowerCase().includes(q) ||
        node.page?.slug?.toLowerCase().includes(q)
      );
    },
    [pageType, menuItemsSearchQuery]
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{typeLabel} Page</h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={() => navigate('/admin/pages')} variant="default">
          Add to Pages
        </Button>
        <Button onClick={() => navigate('/admin/page-sections')} variant="outline" asChild>
          <Link to="/admin/page-sections">Manage Page Sections</Link>
        </Button>
      </div>

      {/* Pages list */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">{typeLabel} Pages</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {typeLabel.toLowerCase()} pages yet. Add one in Pages & Navigation.
            </p>
          ) : (
            <div className="space-y-2">
              {pages.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.title}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', getTypeBadgeColor(p.source_entity_type))}
                      >
                        {getTypeBadgeLabel(p.source_entity_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      /{p.slug === 'home' ? '' : p.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/admin/pages', { state: { editPageId: p.id } })}
                      className="gap-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit page
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/page-sections?page=${p.slug}`} className="gap-1.5">
                        <LayoutGrid className="h-4 w-4" />
                        Sections
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPageToDelete(p)}
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

      {/* Menu items */}
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 text-primary/70" />
            <span>
              {typeLabel} pages show in this menu list with a <span className="font-semibold">{typeLabel}</span> type badge. Drag to reorder items per location.
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
                  filterFn={menuItemsFilterFn}
                  onEditPage={handleEditPageFromMenu}
                  onRemoveFromMenu={handleRemoveFromMenu}
                  onToggleVisibility={(menuItemId, is_active) =>
                    toggleMenuItemVisibilityMutation.mutate({ menuItemId, is_active })
                  }
                  isVisibilityPending={toggleMenuItemVisibilityMutation.isPending}
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

      <AlertDialog open={!!pageToDelete} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pageToDelete?.title}&quot;? This will remove it from Pages &amp; Navigation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pageToDelete && deletePageMutation.mutate(pageToDelete.id)}
              disabled={deletePageMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
