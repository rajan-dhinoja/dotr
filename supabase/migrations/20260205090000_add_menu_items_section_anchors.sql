-- Add fields to support menu items that deep-link to specific page sections

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS section_anchor TEXT,
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.page_sections (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.menu_items.section_anchor IS 'Optional anchor string used for deep-linking to a section on the target page (e.g. section-<page_section_id>).';
COMMENT ON COLUMN public.menu_items.section_id IS 'Optional foreign key to page_sections.id representing the linked section.';

