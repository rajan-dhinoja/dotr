import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/DataTable';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { LazyEntityJsonEditor } from '@/components/admin/LazyEntityJsonEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Testimonial = Tables<'testimonials'>;

export default function AdminTestimonials() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [authorImage, setAuthorImage] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [jsonIsValid, setJsonIsValid] = useState(true);
  const [jsonData, setJsonData] = useState<Record<string, unknown>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ['admin-testimonials'],
    queryFn: async () => {
      const { data } = await supabase.from('testimonials').select('*').order('display_order');
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (testimonial: Partial<Testimonial>) => {
      if (editing) {
        const { error } = await supabase.from('testimonials').update(testimonial).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('testimonials').insert(testimonial as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      setOpen(false);
      setEditing(null);
      setAuthorImage('');
      setIsFeatured(false);
      toast({ title: editing ? 'Testimonial updated' : 'Testimonial added' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('testimonials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast({ title: 'Testimonial deleted' });
    },
  });

  const handleEdit = (testimonial: Testimonial) => {
    setEditing(testimonial);
    setAuthorImage(testimonial.author_image ?? '');
    setIsFeatured(testimonial.is_featured ?? false);
    setJsonData({
      author_name: testimonial.author_name || '',
      author_role: testimonial.author_role || '',
      author_company: testimonial.author_company || '',
      content: testimonial.content || '',
      author_image: testimonial.author_image || '',
      rating: testimonial.rating || 5,
      is_featured: testimonial.is_featured || false,
      display_order: testimonial.display_order || 0,
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
    const data: Partial<Testimonial> = activeTab === 'json' ? {
      author_name: (jsonData.author_name as string) || '',
      content: (jsonData.content as string) || '',
      author_role: (jsonData.author_role as string) || null,
      author_company: (jsonData.author_company as string) || null,
      author_image: (jsonData.author_image as string) || null,
      rating: Number(jsonData.rating) || 5,
      is_featured: (jsonData.is_featured as boolean) || false,
      display_order: Number(jsonData.display_order) || 0,
    } : (() => {
      const form = new FormData(e.currentTarget);
      const author_name = form.get('author_name')?.toString() ?? '';
      const content = form.get('content')?.toString() ?? '';

      if (!author_name || !content) {
        toast({ title: 'Validation Error', description: 'Author name and content are required', variant: 'destructive' });
        return null;
      }

      return {
        author_name,
        content,
        author_role: form.get('author_role')?.toString() || null,
        author_company: form.get('author_company')?.toString() || null,
        author_image: authorImage || null,
        rating: Number(form.get('rating')) || 5,
        is_featured: isFeatured,
        display_order: Number(form.get('display_order')) || 0,
      };
    })();

    if (!data) return;

    saveMutation.mutate(data);
  };

  const columns = [
    { key: 'author_name', label: 'Name' },
    { key: 'author_company', label: 'Company' },
    {
      key: 'content',
      label: 'Testimonial',
      render: (t: Testimonial) => (t.content?.slice(0, 50) ?? '') + '...',
    },
    { key: 'display_order', label: 'Order' },
  ];

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Testimonials</h1>
        <Button onClick={() => { 
          setEditing(null); 
          setAuthorImage(''); 
          setIsFeatured(false); 
          setJsonData({});
          setActiveTab('form');
          setOpen(true); 
        }}>
          <Plus className="h-4 w-4 mr-2" /> Add Testimonial
        </Button>
      </div>

      <DataTable
        data={testimonials}
        columns={columns}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={(t) => deleteMutation.mutate(t.id)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Testimonial' : 'Add Testimonial'}</DialogTitle>
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
                    <Label>Author Name</Label>
                    <Input name="author_name" defaultValue={editing?.author_name} required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input name="author_role" defaultValue={editing?.author_role ?? ''} maxLength={100} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input name="author_company" defaultValue={editing?.author_company ?? ''} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Testimonial Content</Label>
                  <Textarea name="content" defaultValue={editing?.content} rows={4} required maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label>Author Photo</Label>
                  <ImageUpload
                    bucket="team-images"
                    value={authorImage || undefined}
                    onChange={(url) => setAuthorImage(url ?? '')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rating (1-5)</Label>
                    <Input name="rating" type="number" min={1} max={5} defaultValue={editing?.rating ?? 5} />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input name="display_order" type="number" defaultValue={editing?.display_order ?? 0} min={0} max={9999} />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="is_featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
                  <Label htmlFor="is_featured">Featured</Label>
                </div>
              </TabsContent>

              <TabsContent value="json" className="mt-4">
                <LazyEntityJsonEditor
                  entityType="testimonial"
                  entityId={editing?.id}
                  value={jsonData}
                  onChange={(value) => setJsonData(value)}
                  onValidationChange={setJsonIsValid}
                  fileName={editing?.author_name || 'testimonial'}
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