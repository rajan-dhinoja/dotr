import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { BulkDeleteDialog } from '@/components/admin/BulkDeleteDialog';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { LazyEntityJsonEditor } from '@/components/admin/LazyEntityJsonEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAdminList } from '@/hooks/useAdminList';
import { useBulkActions } from '@/hooks/useBulkActions';
import { getModuleConfig } from '@/config/adminModules';
import type { Tables } from '@/integrations/supabase/types';

type BlogPost = Tables<'blog_posts'>;

export default function AdminBlogPosts() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [coverImage, setCoverImage] = useState<string>('');
  const [isPublished, setIsPublished] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [jsonIsValid, setJsonIsValid] = useState(true);
  const [jsonData, setJsonData] = useState<Record<string, unknown>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const moduleConfig = getModuleConfig('blog-posts');
  const {
    data: posts = [],
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
  } = useAdminList<BlogPost>({
    tableName: 'blog_posts',
    queryKey: ['admin-blog-posts'],
    searchFields: moduleConfig?.searchFields || ['title', 'slug'],
    defaultSort: moduleConfig?.defaultSort,
    pageSize: moduleConfig?.pageSize || 20,
  });

  const { bulkDelete, isPending: isBulkDeleting } = useBulkActions({
    tableName: 'blog_posts',
    queryKey: ['admin-blog-posts'],
    onSuccess: (action, count) => {
      toast({ title: `Deleted ${count} posts` });
      setSelectedIds([]);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (post: Partial<BlogPost>) => {
      if (editing) {
        const { error } = await supabase.from('blog_posts').update(post).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blog_posts').insert(post as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      setOpen(false);
      setEditing(null);
      setCoverImage('');
      setIsPublished(false);
      toast({ title: editing ? 'Post updated' : 'Post created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast({ title: 'Post deleted' });
    },
  });

  const handleEdit = (post: BlogPost) => {
    setEditing(post);
    setCoverImage(post.cover_image ?? '');
    setIsPublished(post.is_published ?? false);
    setJsonData({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      cover_image: post.cover_image || '',
      is_published: post.is_published || false,
      published_at: post.published_at || null,
    });
    setActiveTab('form');
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
    const data: Partial<BlogPost> = activeTab === 'json' ? {
      title: (jsonData.title as string) || '',
      slug: (jsonData.slug as string) || '',
      excerpt: (jsonData.excerpt as string) || null,
      content: (jsonData.content as string) || '',
      cover_image: (jsonData.cover_image as string) || null,
      is_published: (jsonData.is_published as boolean) || false,
      published_at: (jsonData.is_published as boolean) ? (jsonData.published_at as string) || new Date().toISOString() : null,
    } : (() => {
      const form = new FormData(e.currentTarget);
      const title = form.get('title')?.toString() ?? '';
      const slug = form.get('slug')?.toString() ?? '';
      const excerpt = form.get('excerpt')?.toString() || null;
      const content = form.get('content')?.toString() ?? '';

      if (!title || !slug || !content) {
        toast({ title: 'Validation Error', description: 'Title, slug, and content are required', variant: 'destructive' });
        return null;
      }

      return {
        title,
        slug,
        excerpt,
        content,
        cover_image: coverImage || null,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
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

  const columns = [
    {
      key: 'cover_image',
      label: 'Image',
      render: (p: BlogPost) => p.cover_image ? (
        <img src={p.cover_image} alt="" className="h-10 w-16 object-cover rounded" />
      ) : '-',
    },
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'is_published',
      label: 'Status',
      render: (p: BlogPost) => (
        <Badge variant={p.is_published ? 'default' : 'secondary'}>
          {p.is_published ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (p: BlogPost) => new Date(p.created_at).toLocaleDateString(),
      sortable: true,
    },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Blog Posts</h1>
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
          setIsPublished(false);
          setJsonData({});
          setActiveTab('form');
          setOpen(true);
        }}
        addButtonLabel="Add Post"
        onClearFilters={clearFilters}
      />

      <div className="mt-6">
        <AdminDataTable
          data={posts}
          columns={columns}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortConfig={sortConfig}
          onSortChange={(field, direction) => setSortConfig({ field, direction })}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={(p) => deleteMutation.mutate(p.id)}
          emptyMessage="No blog posts found"
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

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedIds.length}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
        itemName="posts"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Post' : 'Add Post'}</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit}>
              <TabsContent value="form" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="title" defaultValue={editing?.title} required maxLength={300} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input name="slug" defaultValue={editing?.slug} required maxLength={100} />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_published"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                  <Label htmlFor="is_published">Published</Label>
                </div>
                <div className="space-y-2">
                  <Label>Excerpt</Label>
                  <Textarea name="excerpt" defaultValue={editing?.excerpt ?? ''} rows={2} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea name="content" defaultValue={editing?.content ?? ''} rows={10} required maxLength={100000} />
                </div>
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <ImageUpload
                    bucket="blog-images"
                    value={coverImage || undefined}
                    onChange={(url) => setCoverImage(url ?? '')}
                  />
                </div>
              </TabsContent>

              <TabsContent value="json" className="mt-4">
                <LazyEntityJsonEditor
                  entityType="blog_post"
                  entityId={editing?.id}
                  value={jsonData}
                  onChange={(value) => setJsonData(value)}
                  onValidationChange={setJsonIsValid}
                  fileName={editing?.title || 'blog-post'}
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
    </AdminLayout>
  );
}