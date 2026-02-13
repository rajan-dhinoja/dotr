import { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type MenuItemKindFilter = 'all' | 'page_link' | 'section_link';
export type MenuSortOption = 'default' | 'label-asc' | 'label-desc';

const PAGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: '__null__', label: 'Manual' },
  { value: 'about', label: 'About' },
  { value: 'contact', label: 'Contact' },
  { value: 'blog', label: 'Blog' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'service_category', label: 'Service Category' },
  { value: 'service', label: 'Service' },
] as const;

export interface MenuFilterSortBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemKind: MenuItemKindFilter;
  onItemKindChange: (value: MenuItemKindFilter) => void;
  pageTypeFilter: string;
  onPageTypeFilterChange: (value: string) => void;
  sortBy: MenuSortOption;
  onSortByChange: (value: MenuSortOption) => void;
  onClearAll: () => void;
  className?: string;
}

const hasActiveFilters = (
  searchQuery: string,
  itemKind: MenuItemKindFilter,
  pageTypeFilter: string
) =>
  searchQuery.trim() !== '' || itemKind !== 'all' || (pageTypeFilter !== '' && pageTypeFilter !== 'all');

function activeFilterCount(
  searchQuery: string,
  itemKind: MenuItemKindFilter,
  pageTypeFilter: string
): number {
  let n = 0;
  if (searchQuery.trim() !== '') n++;
  if (itemKind !== 'all') n++;
  if (pageTypeFilter !== '' && pageTypeFilter !== 'all') n++;
  return n;
}

export function MenuFilterSortBar({
  searchQuery,
  onSearchChange,
  itemKind,
  onItemKindChange,
  pageTypeFilter,
  onPageTypeFilterChange,
  sortBy,
  onSortByChange,
  onClearAll,
  className,
}: MenuFilterSortBarProps) {
  const active = hasActiveFilters(searchQuery, itemKind, pageTypeFilter);
  const count = activeFilterCount(searchQuery, itemKind, pageTypeFilter);
  const pageTypeValue = pageTypeFilter && pageTypeFilter !== 'all' ? pageTypeFilter : 'all';
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-10 gap-2 rounded-lg border-muted-foreground/20 bg-background/80 pl-3 pr-3',
              active && 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
            )}
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span>Filters &amp; sort</span>
            {count > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[380px] max-w-[calc(100vw-2rem)] p-0"
        >
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filter &amp; sort menu items
              </h3>
              {active && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-8 text-xs"
                  onClick={() => {
                    onClearAll();
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-5 p-4">
            {/* Search */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Label, title, slug, URL..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-10 rounded-lg"
                  aria-label="Search menu items"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                    onClick={() => onSearchChange('')}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Item kind */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Item kind</Label>
              <ToggleGroup
                type="single"
                value={itemKind}
                onValueChange={(v) => v && onItemKindChange(v as MenuItemKindFilter)}
                className="inline-flex w-full rounded-lg border bg-muted/30 p-0.5 gap-0"
              >
                <ToggleGroupItem
                  value="all"
                  aria-label="All items"
                  className="flex-1 rounded-md px-3 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
                >
                  All
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="page_link"
                  aria-label="Page links only"
                  className="flex-1 rounded-md px-3 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
                >
                  Page links
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="section_link"
                  aria-label="Section links only"
                  className="flex-1 rounded-md px-3 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
                >
                  Section links
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Page type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Page type</Label>
              <Select
                value={pageTypeValue}
                onValueChange={(v) => onPageTypeFilterChange(v === 'all' ? '' : v)}
                disabled={itemKind === 'section_link'}
              >
                <SelectTrigger className="h-10 rounded-lg w-full">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {itemKind === 'section_link' && (
                <p className="text-[11px] text-muted-foreground">
                  Section links don&apos;t have a page type.
                </p>
              )}
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Sort by</Label>
              <Select
                value={sortBy}
                onValueChange={(v) => onSortByChange(v as MenuSortOption)}
              >
                <SelectTrigger className="h-10 rounded-lg w-full">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default order</SelectItem>
                  <SelectItem value="label-asc">Label A → Z</SelectItem>
                  <SelectItem value="label-desc">Label Z → A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
