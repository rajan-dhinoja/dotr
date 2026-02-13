import { Trash2 } from 'lucide-react';
import type { AdminModuleConfig } from '@/lib/types/admin';

export const adminModules: Record<string, AdminModuleConfig> = {
  pages: {
    id: 'pages',
    tableName: 'pages',
    displayName: 'Pages',
    searchFields: ['title', 'slug', 'description'],
    sortableFields: [
      { key: 'title', label: 'Title' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'updated_at', label: 'Updated', defaultDirection: 'desc' },
      { key: 'display_order', label: 'Order' },
    ],
    filters: [
      {
        id: 'status',
        type: 'select',
        label: 'Status',
        field: 'is_active',
        options: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ],
      },
      {
        id: 'show_in_navigation',
        type: 'select',
        label: 'In navigation',
        field: 'show_in_navigation',
        options: [
          { value: 'true', label: 'Shown in nav' },
          { value: 'false', label: 'Hidden from nav' },
        ],
      },
      {
        id: 'source_entity_type',
        type: 'select',
        label: 'Type',
        field: 'source_entity_type',
        options: [
          { value: '__null__', label: 'Manual' },
          { value: 'about', label: 'About' },
          { value: 'contact', label: 'Contact' },
          { value: 'blog', label: 'Blog' },
          { value: 'testimonials', label: 'Testimonials' },
          { value: 'portfolio', label: 'Portfolio' },
          { value: 'service_category', label: 'Service Category' },
          { value: 'service', label: 'Service' },
        ],
      },
      {
        id: 'template',
        type: 'select',
        label: 'Template',
        field: 'template',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'landing', label: 'Landing Page' },
          { value: 'blank', label: 'Blank' },
        ],
      },
    ],
    columns: [
      { key: 'title', label: 'Title', sortable: true },
      { key: 'slug', label: 'Slug' },
      { key: 'source_entity_type', label: 'Type' },
      { key: 'template', label: 'Template' },
      { key: 'is_active', label: 'Status', render: 'status-badge' },
      { key: 'show_in_navigation', label: 'In nav', render: 'boolean' },
      { key: 'display_order', label: 'Order', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'display_order', direction: 'asc' },
    pageSize: 20,
  },
  services: {
    id: 'services',
    tableName: 'services',
    displayName: 'Services',
    searchFields: ['name', 'slug', 'tagline', 'description'],
    sortableFields: [
      { key: 'name', label: 'Name' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'updated_at', label: 'Updated', defaultDirection: 'desc' },
      { key: 'display_order', label: 'Order' },
    ],
    filters: [
      {
        id: 'category',
        type: 'select',
        label: 'Category',
        field: 'category_id',
        queryFn: async () => {
          const { data } = await import('@/integrations/supabase/client').then((m) =>
            m.supabase.from('service_categories').select('id, name').order('display_order')
          );
          return (data || []).map((c) => ({ value: c.id, label: c.name }));
        },
      },
      {
        id: 'featured',
        type: 'boolean',
        label: 'Featured',
        field: 'is_featured',
      },
    ],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'slug', label: 'Slug' },
      { key: 'category_id', label: 'Category' },
      { key: 'display_order', label: 'Order', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'display_order', direction: 'asc' },
    pageSize: 20,
  },
  'service-categories': {
    id: 'service-categories',
    tableName: 'service_categories',
    displayName: 'Service Categories',
    searchFields: ['name', 'slug', 'description'],
    sortableFields: [
      { key: 'name', label: 'Name' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'display_order', label: 'Order' },
    ],
    filters: [],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'slug', label: 'Slug' },
      { key: 'display_order', label: 'Order', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'display_order', direction: 'asc' },
    pageSize: 20,
  },
  'blog-posts': {
    id: 'blog-posts',
    tableName: 'blog_posts',
    displayName: 'Blog Posts',
    searchFields: ['title', 'slug', 'excerpt', 'content'],
    sortableFields: [
      { key: 'title', label: 'Title' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'updated_at', label: 'Updated', defaultDirection: 'desc' },
      { key: 'published_at', label: 'Published', defaultDirection: 'desc' },
    ],
    filters: [
      {
        id: 'status',
        type: 'select',
        label: 'Status',
        field: 'is_published',
        options: [
          { value: 'true', label: 'Published' },
          { value: 'false', label: 'Draft' },
        ],
      },
    ],
    columns: [
      { key: 'cover_image', label: 'Image' },
      { key: 'title', label: 'Title', sortable: true },
      { key: 'is_published', label: 'Status', render: 'status-badge' },
      { key: 'created_at', label: 'Created', render: 'date', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'created_at', direction: 'desc' },
    pageSize: 20,
  },
  'blog-categories': {
    id: 'blog-categories',
    tableName: 'blog_categories',
    displayName: 'Blog Categories',
    searchFields: ['name', 'slug', 'description'],
    sortableFields: [
      { key: 'name', label: 'Name' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
    ],
    filters: [
      {
        id: 'status',
        type: 'select',
        label: 'Status',
        field: 'is_active',
        options: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ],
      },
    ],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'slug', label: 'Slug' },
      { key: 'is_active', label: 'Status', render: 'status-badge' },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'name', direction: 'asc' },
    pageSize: 20,
  },
  projects: {
    id: 'projects',
    tableName: 'projects',
    displayName: 'Projects',
    searchFields: ['name', 'slug', 'description'],
    sortableFields: [
      { key: 'name', label: 'Name' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'display_order', label: 'Order' },
    ],
    filters: [
      {
        id: 'featured',
        type: 'boolean',
        label: 'Featured',
        field: 'is_featured',
      },
    ],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'slug', label: 'Slug' },
      { key: 'is_featured', label: 'Featured', render: 'boolean' },
      { key: 'display_order', label: 'Order', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'display_order', direction: 'asc' },
    pageSize: 20,
  },
  team: {
    id: 'team',
    tableName: 'team_members',
    displayName: 'Team Members',
    searchFields: ['name', 'role', 'bio'],
    sortableFields: [
      { key: 'name', label: 'Name' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'display_order', label: 'Order' },
    ],
    filters: [],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'role', label: 'Role' },
      { key: 'display_order', label: 'Order', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'display_order', direction: 'asc' },
    pageSize: 20,
  },
  testimonials: {
    id: 'testimonials',
    tableName: 'testimonials',
    displayName: 'Testimonials',
    searchFields: ['name', 'company', 'content'],
    sortableFields: [
      { key: 'name', label: 'Name' },
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'display_order', label: 'Order' },
    ],
    filters: [],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'company', label: 'Company' },
      { key: 'display_order', label: 'Order', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'display_order', direction: 'asc' },
    pageSize: 20,
  },
  'form-submissions': {
    id: 'form-submissions',
    tableName: 'form_submissions',
    displayName: 'Form Submissions',
    searchFields: ['name', 'email', 'message', 'page_type'],
    sortableFields: [
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'name', label: 'Name' },
    ],
    filters: [
      {
        id: 'status',
        type: 'select',
        label: 'Status',
        field: 'status',
        options: [
          { value: 'new', label: 'New' },
          { value: 'read', label: 'Read' },
          { value: 'processed', label: 'Processed' },
        ],
      },
      {
        id: 'page_type',
        type: 'select',
        label: 'Page',
        field: 'page_type',
        queryFn: async () => {
          const { data } = await import('@/integrations/supabase/client').then((m) =>
            m.supabase
              .from('form_submissions')
              .select('page_type')
              .not('page_type', 'is', null)
          );
          const uniquePages = [...new Set((data || []).map((s) => s.page_type))];
          return uniquePages.map((p) => ({ value: p, label: p }));
        },
      },
    ],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status', render: 'status-badge' },
      { key: 'created_at', label: 'Created', render: 'date', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'created_at', direction: 'desc' },
    pageSize: 20,
  },
  leads: {
    id: 'leads',
    tableName: 'leads',
    displayName: 'Contact Leads',
    searchFields: ['name', 'email', 'message'],
    sortableFields: [
      { key: 'created_at', label: 'Created', defaultDirection: 'desc' },
      { key: 'name', label: 'Name' },
    ],
    filters: [],
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email' },
      { key: 'created_at', label: 'Created', render: 'date', sortable: true },
    ],
    bulkActions: [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: 'delete',
        requiresConfirmation: true,
        variant: 'destructive',
      },
    ],
    defaultSort: { field: 'created_at', direction: 'desc' },
    pageSize: 20,
  },
};

/**
 * Get configuration for a specific module
 */
export function getModuleConfig(moduleId: string): AdminModuleConfig | undefined {
  return adminModules[moduleId];
}
