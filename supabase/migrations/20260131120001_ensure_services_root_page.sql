-- Ensure the root "services" page exists for service category hierarchy
-- Required for auto-sync: categories have parent_id = services page id

INSERT INTO public.pages (id, title, slug, description, template, parent_id, is_active, is_system, show_in_nav, show_in_navigation, display_order, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Services',
  'services',
  'Our comprehensive digital solutions',
  'default',
  NULL,
  true,
  true,
  true,
  true,
  2,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.pages WHERE slug = 'services');
