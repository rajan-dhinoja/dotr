import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { LazyEntityJsonEditor } from '@/components/admin/LazyEntityJsonEditor';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Save } from 'lucide-react';

type SettingValue = Record<string, any>;

export default function AdminSettings() {
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [allSettingsJson, setAllSettingsJson] = useState<Record<string, SettingValue>>({});
  const [jsonIsValid, setJsonIsValid] = useState(true);

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (error) throw error;
      const settingsMap: Record<string, SettingValue> = {};
      (data || []).forEach((s) => {
        settingsMap[s.key] = s.value as SettingValue;
      });
      
      // Initialize JSON data with all settings
      setAllSettingsJson(settingsMap);
      
      return settingsMap;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: SettingValue }) => {
      const { data: existing } = await supabase.from('site_settings').select('id').eq('key', key).maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('site_settings').update({ value }).eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('site_settings').insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      logActivity({ action: 'update', entity_type: 'site_settings', entity_name: key });
      toast({ title: 'Settings saved' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleSave = (key: string) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value: SettingValue = {};
    form.forEach((v, k) => { value[k] = v.toString(); });
    saveMutation.mutate({ key, value });
  };

  const handleSaveAllJson = async () => {
    if (!jsonIsValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix JSON validation errors before saving',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Save each setting key from JSON
      const savePromises = Object.entries(allSettingsJson).map(([key, value]) => {
        return saveMutation.mutateAsync({ key, value: value as SettingValue });
      });

      await Promise.all(savePromises);
      toast({ title: 'All settings saved' });
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <AdminLayout><div className="text-center py-12">Loading settings...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your website settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic site information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave('general')} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Site Name</Label>
                    <Input name="site_name" defaultValue={settings.general?.site_name || 'DOTR'} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tagline</Label>
                    <Input name="tagline" defaultValue={settings.general?.tagline || ''} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input name="admin_email" type="email" defaultValue={settings.general?.admin_email || ''} />
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Logo and visual identity</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave('branding')} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Logo URL (Light)</Label>
                    <Input name="logo_light" defaultValue={settings.branding?.logo_light || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo URL (Dark)</Label>
                    <Input name="logo_dark" defaultValue={settings.branding?.logo_dark || ''} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <Input name="favicon" defaultValue={settings.branding?.favicon || ''} />
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>Your social media profiles</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave('social')} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Facebook</Label>
                    <Input name="facebook" defaultValue={settings.social?.facebook || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter/X</Label>
                    <Input name="twitter" defaultValue={settings.social?.twitter || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input name="instagram" defaultValue={settings.social?.instagram || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn</Label>
                    <Input name="linkedin" defaultValue={settings.social?.linkedin || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube</Label>
                    <Input name="youtube" defaultValue={settings.social?.youtube || ''} />
                  </div>
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Business contact details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave('contact')} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input name="phone" defaultValue={settings.contact?.phone || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" defaultValue={settings.contact?.email || ''} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea name="address" defaultValue={settings.contact?.address || ''} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Business Hours</Label>
                  <Input name="hours" defaultValue={settings.contact?.hours || ''} placeholder="Mon-Fri: 9AM-5PM" />
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>SEO Defaults</CardTitle>
              <CardDescription>Default meta tags for pages</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave('seo')} className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Meta Title</Label>
                  <Input name="meta_title" defaultValue={settings.seo?.meta_title || ''} maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Default Meta Description</Label>
                  <Textarea name="meta_description" defaultValue={settings.seo?.meta_description || ''} rows={3} maxLength={160} />
                </div>
                <div className="space-y-2">
                  <Label>Default OG Image URL</Label>
                  <Input name="og_image" defaultValue={settings.seo?.og_image || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Google Analytics ID</Label>
                  <Input name="ga_id" defaultValue={settings.seo?.ga_id || ''} placeholder="G-XXXXXXXXXX" />
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>All Settings (JSON)</CardTitle>
              <CardDescription>Edit all site settings as JSON. Changes will be saved to their respective setting keys.</CardDescription>
            </CardHeader>
            <CardContent>
              <LazyEntityJsonEditor
                entityType="site_setting"
                value={allSettingsJson}
                onChange={(value) => setAllSettingsJson(value)}
                onValidationChange={setJsonIsValid}
                fileName="site-settings"
              />
              <div className="mt-4">
                <Button 
                  onClick={handleSaveAllJson}
                  disabled={saveMutation.isPending || !jsonIsValid}
                >
                  <Save className="h-4 w-4 mr-2" /> Save All Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
