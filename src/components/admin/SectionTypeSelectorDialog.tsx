import { useEffect, useMemo, useRef, useState } from 'react';
import type { SectionType } from '@/hooks/usePageSections';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface SectionTypeSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionTypes: SectionType[];
  onSelectType: (slug: string) => void;
  pageType: string;
  /**
   * Slugs of section types that are already used on the current page.
   * These will be shown at the end of the list and treated as
   * click-to-edit instead of click-to-add in the parent component.
   */
  usedSectionSlugs?: string[];
}

type SortMode = 'alphabetical' | 'recent' | 'complexity';

interface SectionTypeWithMeta extends SectionType {
  searchIndex: string;
  isUsed: boolean;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'core', label: 'Core sections' },
  { value: 'visual-media', label: 'Visual & media' },
  { value: 'utility', label: 'Utility' },
  { value: 'trust', label: 'Trust & social proof' },
  { value: 'value', label: 'Value communication' },
  { value: 'showcase', label: 'Visual showcase' },
  { value: 'features', label: 'Feature sections' },
  { value: 'cta', label: 'CTA sections' },
  { value: 'company', label: 'Company' },
  { value: 'form', label: 'Form sections' },
];

const CATEGORY_SLUGS: Record<string, string[]> = {
  core: ['hero', 'features', 'process', 'testimonials', 'stats', 'faq', 'cta', 'gallery', 'team', 'pricing'],
  'visual-media': ['logo-cloud', 'services-grid', 'portfolio-grid', 'video', 'image-text', 'timeline'],
  utility: ['divider', 'usp-strip', 'kpi-strip', 'counters', 'newsletter', 'blog-posts', 'contact-info'],
  trust: ['social-proof-bar', 'success-metrics', 'awards-badges', 'press-mentions', 'ratings-reviews', 'trust-badges', 'differentiators'],
  value: ['problem-statement', 'agitate-solve', 'value-proposition', 'elevator-pitch', 'outcomes-benefits', 'who-its-for'],
  showcase: ['before-after', 'video-demo', 'screenshot-gallery', 'device-frames'],
  features: ['feature-list', 'feature-highlights'],
  cta: ['primary-cta-banner', 'secondary-cta', 'exit-intent-cta'],
  company: ['about-us', 'values-culture'],
  form: ['form'],
};

const COMPLEXITY_ORDER: Record<'simple' | 'medium' | 'complex', number> = {
  simple: 0,
  medium: 1,
  complex: 2,
};

// Derived from docs/section-inventory.md
const COMPLEXITY_BY_SLUG: Record<string, 'simple' | 'medium' | 'complex'> = {
  // Core Sections
  hero: 'simple',
  features: 'medium',
  process: 'medium',
  testimonials: 'medium',
  stats: 'simple',
  faq: 'simple',
  cta: 'simple',
  gallery: 'medium',
  team: 'medium',
  pricing: 'complex',
  // Visual & Media
  'logo-cloud': 'simple',
  'services-grid': 'medium',
  'portfolio-grid': 'medium',
  video: 'simple',
  'image-text': 'simple',
  timeline: 'medium',
  // Utility
  divider: 'simple',
  'usp-strip': 'simple',
  'kpi-strip': 'simple',
  counters: 'simple',
  newsletter: 'simple',
  'blog-posts': 'simple',
  'contact-info': 'medium',
  // Trust & Social Proof
  'social-proof-bar': 'medium',
  'success-metrics': 'medium',
  'awards-badges': 'medium',
  'press-mentions': 'medium',
  'ratings-reviews': 'medium',
  'trust-badges': 'simple',
  differentiators: 'medium',
  // Value Communication
  'problem-statement': 'medium',
  'agitate-solve': 'simple',
  'value-proposition': 'medium',
  'elevator-pitch': 'simple',
  'outcomes-benefits': 'medium',
  'who-its-for': 'medium',
  // Visual Showcase
  'before-after': 'simple',
  'video-demo': 'medium',
  'screenshot-gallery': 'medium',
  'device-frames': 'medium',
  // Feature Sections
  'feature-list': 'simple',
  'feature-highlights': 'complex',
  // CTA Sections
  'primary-cta-banner': 'simple',
  'secondary-cta': 'simple',
  'exit-intent-cta': 'simple',
  // Company Sections
  'about-us': 'medium',
  'values-culture': 'medium',
  // Form Sections
  form: 'complex',
};

const RECENT_STORAGE_KEY_PREFIX = 'section-type-recent:';
const SORT_STORAGE_KEY_PREFIX = 'section-type-sort:';
const CATEGORY_STORAGE_KEY_PREFIX = 'section-type-category:';

function safeLoadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSaveToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors (e.g. privacy mode)
  }
}

export function SectionTypeSelectorDialog({
  open,
  onOpenChange,
  sectionTypes,
  onSelectType,
  pageType,
  usedSectionSlugs,
}: SectionTypeSelectorDialogProps) {
  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recentlyUsedSlugs, setRecentlyUsedSlugs] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load preferences when dialog opens
  useEffect(() => {
    if (!open) return;

    const recentKey = `${RECENT_STORAGE_KEY_PREFIX}${pageType}`;
    const sortKey = `${SORT_STORAGE_KEY_PREFIX}${pageType}`;
    const categoryKey = `${CATEGORY_STORAGE_KEY_PREFIX}${pageType}`;

    setRecentlyUsedSlugs((prev) => {
      if (prev.length) return prev;
      return safeLoadFromStorage<string[]>(recentKey, []);
    });
    setSortMode((prev) => {
      if (prev !== 'alphabetical') return prev;
      const stored = safeLoadFromStorage<string | null>(sortKey, 'alphabetical');
      return stored === 'recent' || stored === 'complexity' || stored === 'alphabetical'
        ? (stored as SortMode)
        : 'alphabetical';
    });
    setSelectedCategory((prev) => {
      if (prev !== 'all') return prev;
      return safeLoadFromStorage<string>(categoryKey, 'all');
    });

    // Focus search input on open
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open, pageType]);

  // Debounce search input for better responsiveness on slower devices
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery(rawSearchQuery);
    }, 150);

    return () => {
      window.clearTimeout(handle);
    };
  }, [rawSearchQuery]);

  // Compute section types with search index
  const sectionTypesWithMeta: SectionTypeWithMeta[] = useMemo(() => {
    const usedSlugs = new Set<string>(usedSectionSlugs ?? []);

    return sectionTypes.map((type) => {
      const parts = [type.name, type.slug, type.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return {
        ...type,
        searchIndex: parts,
        isUsed: usedSlugs.has(type.slug),
      };
    });
  }, [sectionTypes, usedSectionSlugs]);

  const filteredSectionTypes = useMemo(() => {
    let items = sectionTypesWithMeta;
    const query = searchQuery.trim().toLowerCase();

    if (selectedCategory !== 'all') {
      const allowedSlugs = CATEGORY_SLUGS[selectedCategory] ?? [];
      items = items.filter((type) => allowedSlugs.includes(type.slug));
    }

    if (query) {
      items = items.filter((type) => type.searchIndex.includes(query));
    }

    const recentOrder = new Map<string, number>();
    recentlyUsedSlugs.forEach((slug, index) => {
      recentOrder.set(slug, index);
    });

    items = [...items].sort((a, b) => {
      if (sortMode === 'recent') {
        const aIndex = recentOrder.has(a.slug) ? recentOrder.get(a.slug)! : Number.MAX_SAFE_INTEGER;
        const bIndex = recentOrder.has(b.slug) ? recentOrder.get(b.slug)! : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
      } else if (sortMode === 'complexity') {
        const aLevel = COMPLEXITY_BY_SLUG[a.slug] ?? 'medium';
        const bLevel = COMPLEXITY_BY_SLUG[b.slug] ?? 'medium';
        const aComplexity = COMPLEXITY_ORDER[aLevel];
        const bComplexity = COMPLEXITY_ORDER[bLevel];
        if (aComplexity !== bComplexity) return aComplexity - bComplexity;
      }

      // Fallback / secondary sort: always alphabetical for stability
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return items;
  }, [sectionTypesWithMeta, searchQuery, sortMode, selectedCategory, recentlyUsedSlugs]);

  const totalCount = sectionTypes.length;
  const filteredCount = filteredSectionTypes.length;

  const unusedSectionTypes = filteredSectionTypes.filter((type) => !type.isUsed);
  const usedSectionTypes = filteredSectionTypes.filter((type) => type.isUsed);

  const handleSelect = (slug: string) => {
    const recentKey = `${RECENT_STORAGE_KEY_PREFIX}${pageType}`;
    const sortKey = `${SORT_STORAGE_KEY_PREFIX}${pageType}`;
    const categoryKey = `${CATEGORY_STORAGE_KEY_PREFIX}${pageType}`;

    setRecentlyUsedSlugs((prev) => {
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, 15);
      safeSaveToStorage(recentKey, next);
      return next;
    });
    safeSaveToStorage(sortKey, sortMode);
    safeSaveToStorage(categoryKey, selectedCategory);

    onSelectType(slug);
  };

  const handleClearSearchAndFilters = () => {
    setRawSearchQuery('');
    setSearchQuery('');
    setSelectedCategory('all');
    setSortMode('alphabetical');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Section Type</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Showing {filteredCount} of {totalCount} sections
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="w-full sm:max-w-xs">
            <Label htmlFor="section-type-search" className="sr-only">
              Search sections
            </Label>
            <Input
              id="section-type-search"
              ref={searchInputRef}
              placeholder="Search sections..."
              value={rawSearchQuery}
              onChange={(e) => setRawSearchQuery(e.target.value)}
              aria-label="Search sections"
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-start sm:justify-end w-full sm:w-auto">
            <div className="min-w-[140px]">
              <Label htmlFor="section-type-sort" className="sr-only">
                Sort sections
              </Label>
              <Select
                value={sortMode}
                onValueChange={(value) => setSortMode(value as SortMode)}
              >
                <SelectTrigger id="section-type-sort" aria-label="Sort sections">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="recent">Recently used</SelectItem>
                  <SelectItem value="complexity">By complexity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label htmlFor="section-type-category" className="sr-only">
                Filter by category
              </Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value)}
              >
                <SelectTrigger id="section-type-category" aria-label="Filter by category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {filteredCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm text-muted-foreground mb-2">
              No sections match your search and filters.
            </p>
            <button
              type="button"
              onClick={handleClearSearchAndFilters}
              className="text-sm text-primary underline underline-offset-2"
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1 pr-2 pb-2">
            {unusedSectionTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleSelect(type.slug)}
                className="flex flex-col items-start gap-2 p-4 rounded-lg border hover:bg-muted transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`Add ${type.name} section`}
              >
                <span className="font-medium text-sm">{type.name}</span>
                {type.description && (
                  <span className="text-xs text-foreground/80 line-clamp-2">
                    {type.description}
                  </span>
                )}
              </button>
            ))}

            {usedSectionTypes.length > 0 && (
              <div className="col-span-full mt-1 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Already used on this page
              </div>
            )}

            {usedSectionTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleSelect(type.slug)}
                className="flex flex-col items-start gap-1 p-4 rounded-lg border border-dashed bg-muted/40 hover:bg-muted/70 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 opacity-90"
                aria-label={`Edit existing ${type.name} section`}
              >
                <span className="font-medium text-sm flex items-center gap-2">
                  {type.name}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-foreground/80 border border-border/60">
                    Used
                  </span>
                </span>
                {type.description && (
                  <span className="text-xs text-foreground/80 line-clamp-2">
                    {type.description}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Click to edit existing section instead of adding a duplicate.
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

