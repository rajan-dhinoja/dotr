-- Navigation system: sites, navigation_menus, navigation_items, optional meta, and page navigation fields

-- 1) Sites table (basic, single-tenant friendly but ready for multi-site)
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure at least one default site exists
INSERT INTO public.sites (name, domain, is_active)
SELECT 'Default Site', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.sites);

-- 2) Navigation menus
CREATE TABLE IF NOT EXISTS public.navigation_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale TEXT DEFAULT 'en',
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'header', -- header, footer, mega, mobile, sidebar, etc.
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT navigation_menus_slug_unique UNIQUE (site_id, locale, slug)
);

-- Seed default menus for the default site (header, footer, mobile) if none exist
INSERT INTO public.navigation_menus (site_id, locale, slug, label, type, is_default, is_active)
SELECT s.id, 'en', m.slug, m.label, m.type, m.is_default, true
FROM public.sites s
JOIN (
  VALUES
    ('header-main', 'Header Main', 'header', true),
    ('footer-main', 'Footer Main', 'footer', true),
    ('mobile-main', 'Mobile Main', 'mobile', true)
) AS m(slug, label, type, is_default) ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.navigation_menus nm WHERE nm.site_id = s.id
);

-- 3) Navigation items (tree-structured, multi-purpose)
CREATE TABLE IF NOT EXISTS public.navigation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.navigation_menus(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.navigation_items(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale TEXT DEFAULT 'en',

  -- Presentation
  label TEXT NOT NULL,
  description TEXT,
  icon_key TEXT,
  badge_text TEXT,
  is_featured BOOLEAN DEFAULT false,

  -- Destination
  target_type TEXT NOT NULL DEFAULT 'page', -- page | external_url | entity | none
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  external_url TEXT,
  entity_type TEXT,
  entity_id UUID,
  open_in_new_tab BOOLEAN DEFAULT false,

  -- Behavior & visibility
  is_active BOOLEAN DEFAULT true,
  is_visible_desktop BOOLEAN DEFAULT true,
  is_visible_mobile BOOLEAN DEFAULT true,
  is_mega_root BOOLEAN DEFAULT false,
  layout_variant TEXT DEFAULT 'simple', -- simple | dropdown | mega | group

  -- Ordering & grouping
  order_index INTEGER DEFAULT 0,
  group_key TEXT,
  column_index INTEGER,

  -- Source & sync
  source TEXT DEFAULT 'manual', -- manual | page_auto
  source_page_path TEXT,
  auto_sync BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Helpful index for ordering within a menu tree
CREATE INDEX IF NOT EXISTS navigation_items_menu_parent_order_idx
  ON public.navigation_items (menu_id, parent_id, order_index);

-- 4) Optional arbitrary metadata per navigation item
CREATE TABLE IF NOT EXISTS public.navigation_item_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navigation_item_id UUID NOT NULL REFERENCES public.navigation_items(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) Extend pages with navigation-centric fields for hybrid auto-sync model
ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS show_in_navigation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_menu_type TEXT DEFAULT 'header',
ADD COLUMN IF NOT EXISTS navigation_label_override TEXT,
ADD COLUMN IF NOT EXISTS navigation_priority INTEGER;

-- 6) Enable RLS and basic policies for new tables
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_item_meta ENABLE ROW LEVEL SECURITY;

-- Sites policies
DROP POLICY IF EXISTS "Admins can manage sites" ON public.sites;
CREATE POLICY "Admins can manage sites" ON public.sites
FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active sites" ON public.sites;
CREATE POLICY "Anyone can view active sites" ON public.sites
FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- Navigation menus policies
DROP POLICY IF EXISTS "Anyone can view active navigation menus" ON public.navigation_menus;
CREATE POLICY "Anyone can view active navigation menus" ON public.navigation_menus
FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage navigation menus" ON public.navigation_menus;
CREATE POLICY "Admins can manage navigation menus" ON public.navigation_menus
FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Navigation items policies
DROP POLICY IF EXISTS "Anyone can view active navigation items" ON public.navigation_items;
CREATE POLICY "Anyone can view active navigation items" ON public.navigation_items
FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage navigation items" ON public.navigation_items;
CREATE POLICY "Admins can manage navigation items" ON public.navigation_items
FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Navigation item meta policies
DROP POLICY IF EXISTS "Anyone can view navigation item meta" ON public.navigation_item_meta;
CREATE POLICY "Anyone can view navigation item meta" ON public.navigation_item_meta
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage navigation item meta" ON public.navigation_item_meta;
CREATE POLICY "Admins can manage navigation item meta" ON public.navigation_item_meta
FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

