-- Add source tracking to pages for auto-managed vs manual pages
-- Enables sync layer to identify pages created by service/service_category sync
-- Run this migration if you see: column pages.source_entity_type does not exist

ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS source_entity_type TEXT DEFAULT NULL;
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS source_entity_id UUID DEFAULT NULL;

-- source_entity_type: 'service_category' | 'service' | null
-- source_entity_id: id of the service_categories or services row

CREATE INDEX IF NOT EXISTS idx_pages_source_entity 
ON public.pages(source_entity_type, source_entity_id) 
WHERE source_entity_type IS NOT NULL;

COMMENT ON COLUMN public.pages.source_entity_type IS 'Entity type that owns this page: service_category or service. Null for manually created pages.';
COMMENT ON COLUMN public.pages.source_entity_id IS 'UUID of the source entity (service_categories.id or services.id).';
