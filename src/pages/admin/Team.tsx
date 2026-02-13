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

type TeamMember = Tables<'team_members'>;

export default function AdminTeam() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [jsonIsValid, setJsonIsValid] = useState(true);
  const [jsonData, setJsonData] = useState<Record<string, unknown>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['admin-team'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').order('display_order');
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (member: Partial<TeamMember>) => {
      if (editing) {
        const { error } = await supabase.from('team_members').update(member).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('team_members').insert(member as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
      setOpen(false);
      setEditing(null);
      setImageUrl('');
      setIsFeatured(false);
      toast({ title: editing ? 'Member updated' : 'Member added' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
      toast({ title: 'Member deleted' });
    },
  });

  const handleEdit = (member: TeamMember) => {
    setEditing(member);
    setImageUrl(member.image_url ?? '');
    setIsFeatured(member.is_featured ?? false);
    
    // Load JSON data from member
    const socialLinks: Record<string, unknown> = {};
    setJsonData({
      name: member.name || '',
      role: member.role || '',
      bio: member.bio || '',
      email: member.email || '',
      image_url: member.image_url || '',
      linkedin: socialLinks.linkedin || member.linkedin_url || '',
      twitter: socialLinks.twitter || member.twitter_url || '',
      github: socialLinks.github || member.github_url || '',
      facebook: socialLinks.facebook || '',
      instagram: socialLinks.instagram || '',
      youtube: socialLinks.youtube || '',
      website: socialLinks.website || '',
      is_featured: member.is_featured || false,
      display_order: member.display_order || 0,
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
    const data: Partial<TeamMember> = activeTab === 'json' ? {
      name: (jsonData.name as string) || '',
      role: (jsonData.role as string) || '',
      bio: (jsonData.bio as string) || null,
      email: (jsonData.email as string) || null,
      image_url: (jsonData.image_url as string) || null,
      linkedin_url: (jsonData.linkedin as string) || null,
      twitter_url: (jsonData.twitter as string) || null,
      github_url: (jsonData.github as string) || null,
      is_featured: (jsonData.is_featured as boolean) || false,
      display_order: Number(jsonData.display_order) || 0,
    } : (() => {
      const form = new FormData(e.currentTarget);
      const name = form.get('name')?.toString() ?? '';
      const role = form.get('role')?.toString() ?? '';

      if (!name || !role) {
        toast({ title: 'Validation Error', description: 'Name and role are required', variant: 'destructive' });
        return null;
      }

      return {
        name,
        role,
        bio: form.get('bio')?.toString() || null,
        email: form.get('email')?.toString() || null,
        image_url: imageUrl || null,
        linkedin_url: form.get('linkedin_url')?.toString() || null,
        twitter_url: form.get('twitter_url')?.toString() || null,
        github_url: form.get('github_url')?.toString() || null,
        is_featured: isFeatured,
        display_order: Number(form.get('display_order')) || 0,
      };
    })();

    if (!data) return;

    saveMutation.mutate(data);
  };

  const columns = [
    {
      key: 'image_url',
      label: 'Photo',
      render: (m: TeamMember) => m.image_url ? (
        <img src={m.image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : '-',
    },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'display_order', label: 'Order' },
  ];

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Team Members</h1>
        <Button onClick={() => { 
          setEditing(null); 
          setImageUrl(''); 
          setIsFeatured(false); 
          setJsonData({});
          setActiveTab('form');
          setOpen(true); 
        }}>
          <Plus className="h-4 w-4 mr-2" /> Add Member
        </Button>
      </div>

      <DataTable
        data={members}
        columns={columns}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={(m) => deleteMutation.mutate(m.id)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Member' : 'Add Member'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" defaultValue={editing?.name} required maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input name="role" defaultValue={editing?.role} required maxLength={100} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={editing?.email ?? ''} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea name="bio" defaultValue={editing?.bio ?? ''} rows={3} maxLength={2000} />
            </div>
            <div className="space-y-2">
              <Label>Profile Image</Label>
              <ImageUpload
                bucket="team-images"
                value={imageUrl || undefined}
                onChange={(url) => setImageUrl(url ?? '')}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input name="linkedin_url" defaultValue={editing?.linkedin_url ?? ''} type="url" />
              </div>
              <div className="space-y-2">
                <Label>Twitter</Label>
                <Input name="twitter_url" defaultValue={editing?.twitter_url ?? ''} type="url" />
              </div>
              <div className="space-y-2">
                <Label>GitHub</Label>
                <Input name="github_url" defaultValue={editing?.github_url ?? ''} type="url" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="is_featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
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
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}