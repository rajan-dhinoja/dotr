import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw,
  GitMerge,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  usePagesImportExport,
  getExistingForReview,
  type PagesImportMode,
  type PagesImportResult,
  type ExistingForReview,
} from '@/hooks/usePagesImportExport';
import {
  parsePagesMenuFile,
  validatePagesMenuImportData,
  type PageImportItem,
  type MenuItemFlat,
  type PagesMenuValidationResult,
} from '@/lib/pagesMenuImportExport';
import { ImportReviewTree } from '@/components/admin/ImportReviewTree';
import type { SortOption } from '@/components/admin/ImportReviewTree';
import {
  buildPageReviewTree,
  buildMenuReviewTree,
  type PageReviewTreeNode,
  type MenuReviewTreeNode,
} from '@/lib/importReviewTree';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface PagesImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'upload' | 'options' | 'review' | 'importing' | 'result';

interface PageReviewRow {
  id: string;
  index: number;
  slug: string;
  title: string;
  parentSlug: string | null;
  hasExisting?: boolean;
  hasConflict?: boolean;
  hasWarning?: boolean;
}

interface MenuReviewRow {
  id: string;
  index: number;
  location: string;
  label: string;
  key: string;
  parentKey: string | null;
  pageSlug: string | null;
  hasExisting?: boolean;
  hasConflict?: boolean;
  hasWarning?: boolean;
}

function MenuItemsReviewTabs({
  menuRows,
  selectedMenuIds,
  setSelectedMenuIds,
  getStatusForRow,
  menuCount,
}: {
  menuRows: MenuReviewRow[];
  selectedMenuIds: string[];
  setSelectedMenuIds: (ids: string[]) => void;
  getStatusForRow: (row: { hasExisting?: boolean; hasConflict?: boolean; hasWarning?: boolean }) => 'new' | 'existing' | 'conflict' | 'warning' | null;
  menuCount: number;
}) {
  const treesByLocation = React.useMemo(
    () => buildMenuReviewTree(menuRows),
    [menuRows]
  );
  const locations = React.useMemo(
    () => Array.from(treesByLocation.keys()).sort(),
    [treesByLocation]
  );

  if (locations.length === 0) {
    return (
      <ImportReviewTree<MenuReviewTreeNode>
        treeNodes={[]}
        totalCount={0}
        selectedIds={selectedMenuIds}
        onSelectionChange={setSelectedMenuIds}
        columns={[
          { key: 'label', header: 'Label', render: (n) => n.label },
          {
            key: 'target',
            header: 'Target',
            render: (n) => (n.pageSlug ? `Page: ${n.pageSlug}` : 'Custom URL'),
          },
        ]}
        getRowStatus={(n) => getStatusForRow(n)}
        getSearchText={(n) =>
          [n.menu_location, n.label, n.key, n.pageSlug].filter(Boolean).join(' ')
        }
        entityLabel="menu items"
        scrollHeight="min-h-[240px] max-h-[50vh]"
      />
    );
  }

  if (locations.length === 1) {
    const roots = treesByLocation.get(locations[0]) ?? [];
    const count = menuRows.filter((r) => r.location === locations[0]).length;
    return (
      <ImportReviewTree<MenuReviewTreeNode>
        treeNodes={roots}
        totalCount={count}
        selectedIds={selectedMenuIds}
        onSelectionChange={setSelectedMenuIds}
        columns={[
          { key: 'label', header: 'Label', render: (n) => n.label },
          {
            key: 'target',
            header: 'Target page / URL',
            render: (n) => (n.pageSlug ? `Page: ${n.pageSlug}` : 'Custom URL'),
          },
        ]}
        getRowStatus={(n) => getStatusForRow(n)}
        getSearchText={(n) =>
          [n.menu_location, n.label, n.key, n.pageSlug].filter(Boolean).join(' ')
        }
        entityLabel="menu items"
        sortOptions={[
          { value: 'default' as SortOption, label: 'Default (hierarchy)' },
          { value: 'label-asc' as SortOption, label: 'Label A→Z' },
        ]}
        getSortKey={(n) => n.label}
        scrollHeight="min-h-[240px] max-h-[50vh]"
      />
    );
  }

  return (
    <Tabs defaultValue={locations[0]} className="w-full">
      <TabsList>
        {locations.map((loc) => (
          <TabsTrigger key={loc} value={loc}>
            {loc}
          </TabsTrigger>
        ))}
      </TabsList>
      {locations.map((loc) => {
        const roots = treesByLocation.get(loc) ?? [];
        const count = menuRows.filter((r) => r.location === loc).length;
        return (
          <TabsContent key={loc} value={loc} className="mt-3">
            <ImportReviewTree<MenuReviewTreeNode>
              treeNodes={roots}
              totalCount={count}
              selectedIds={selectedMenuIds}
              onSelectionChange={setSelectedMenuIds}
              columns={[
                { key: 'label', header: 'Label', render: (n) => n.label },
                {
                  key: 'target',
                  header: 'Target page / URL',
                  render: (n) => (n.pageSlug ? `Page: ${n.pageSlug}` : 'Custom URL'),
                },
              ]}
              getRowStatus={(n) => getStatusForRow(n)}
              getSearchText={(n) =>
                [n.menu_location, n.label, n.key, n.pageSlug].filter(Boolean).join(' ')
              }
              entityLabel="menu items"
              sortOptions={[
                { value: 'default' as SortOption, label: 'Default (hierarchy)' },
                { value: 'label-asc' as SortOption, label: 'Label A→Z' },
              ]}
              getSortKey={(n) => n.label}
              scrollHeight="min-h-[240px] max-h-[50vh]"
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export function PagesImportModal({ open, onOpenChange }: PagesImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<PagesImportMode>('skip');
  const [validation, setValidation] = useState<PagesMenuValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<PagesImportResult | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [menuCount, setMenuCount] = useState(0);
  const [parsedPages, setParsedPages] = useState<PageImportItem[] | null>(null);
  const [parsedMenuItems, setParsedMenuItems] = useState<MenuItemFlat[] | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [step, setStep] = useState<WizardStep>('upload');
  const [existingForReview, setExistingForReview] = useState<ExistingForReview | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importPagesMenu } = usePagesImportExport();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }

    setFile(selectedFile);
    setValidation(null);
    setImportResult(null);
    setIsValidating(true);
    setStep('upload');

    try {
      const importData = await parsePagesMenuFile(selectedFile);
      setParsedPages(importData.pages);
      setParsedMenuItems(importData.menu_items);
      setPageCount(importData.pages.length);
      setMenuCount(importData.menu_items.length);
      const validationResult = validatePagesMenuImportData(importData);
      setValidation(validationResult);
      if (validationResult.valid) {
        // Preselect all items by default
        setSelectedPageIds(importData.pages.map((_, idx) => `page-${idx}`));
        setSelectedMenuIds(importData.menu_items.map((_, idx) => `menu-${idx}`));
        setStep('options');
      }
    } catch (error) {
      setValidation({
        valid: false,
        errors: [
          {
            path: '/',
            message:
              error instanceof Error ? error.message : 'Failed to parse file',
          },
        ],
      });
      setPageCount(0);
      setMenuCount(0);
      setParsedPages(null);
      setParsedMenuItems(null);
      setSelectedPageIds([]);
      setSelectedMenuIds([]);
      setStep('upload');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !validation?.valid) return;

    setIsImporting(true);
    setImportResult(null);
    setStep('importing');

    const selectedPageIndexes =
      parsedPages && selectedPageIds.length > 0
        ? selectedPageIds
            .map((id) => {
              const match = id.match(/^page-(\d+)$/);
              return match ? Number(match[1]) : null;
            })
            .filter((v): v is number => v != null)
        : undefined;

    const selectedMenuIndexes =
      parsedMenuItems && selectedMenuIds.length > 0
        ? selectedMenuIds
            .map((id) => {
              const match = id.match(/^menu-(\d+)$/);
              return match ? Number(match[1]) : null;
            })
            .filter((v): v is number => v != null)
        : undefined;

    try {
      const result = await importPagesMenu(file, {
        onConflict: importMode,
        selection:
          selectedPageIndexes || selectedMenuIndexes
            ? {
                pageIndexes: selectedPageIndexes,
                menuItemIndexes: selectedMenuIndexes,
              }
            : undefined,
      });
      setImportResult(result);
      setStep('result');

      if (result.success) {
        setTimeout(() => {
          handleReset();
          onOpenChange(false);
        }, 2000);
      }
    } catch (error) {
      setImportResult({
        success: false,
        total: 0,
        imported: 0,
        skipped: 0,
        overwritten: 0,
        failed: 1,
        errors: [
          {
            error:
              error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setValidation(null);
    setImportResult(null);
    setPageCount(0);
    setMenuCount(0);
    setImportMode('skip');
    setParsedPages(null);
    setParsedMenuItems(null);
    setSelectedPageIds([]);
    setSelectedMenuIds([]);
    setExistingForReview(null);
    setLoadingExisting(false);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      handleReset();
      onOpenChange(false);
    }
  };

  const handleContinueToReview = async () => {
    if (importMode === 'skip' && parsedMenuItems) {
      setLoadingExisting(true);
      try {
        const existing = await getExistingForReview(parsedMenuItems);
        setExistingForReview(existing);
        const pageRows = (parsedPages ?? []).map((p, index) => ({
          id: `page-${index}`,
          hasExisting: existing.existingPageSlugs.has(p.slug),
        }));
        const menuRows = (parsedMenuItems ?? []).map((m, index) => ({
          id: `menu-${index}`,
          hasExisting: existing.existingMenuKeys.has(`${m.menu_location}:${m.key}`),
        }));
        setSelectedPageIds(pageRows.filter((r) => !r.hasExisting).map((r) => r.id));
        setSelectedMenuIds(menuRows.filter((r) => !r.hasExisting).map((r) => r.id));
      } catch {
        setExistingForReview(null);
        setSelectedPageIds(parsedPages?.map((_, i) => `page-${i}`) ?? []);
        setSelectedMenuIds(parsedMenuItems?.map((_, i) => `menu-${i}`) ?? []);
      } finally {
        setLoadingExisting(false);
        setStep('review');
      }
    } else {
      setExistingForReview(null);
      setStep('review');
    }
  };

  const canImport =
    Boolean(file) &&
    Boolean(validation?.valid) &&
    (selectedPageIds.length > 0 || selectedMenuIds.length > 0) &&
    !isImporting &&
    !isValidating;
  const hasErrors = Boolean(validation && !validation.valid);
  const hasWarnings = Boolean(
    validation?.warnings && validation.warnings.length > 0
  );

  const formatValidationError = (e: {
    message: string;
    pageIndex?: number;
    menuItemIndex?: number;
  }) => {
    if (e.pageIndex != null) return `Page ${e.pageIndex + 1}: ${e.message}`;
    if (e.menuItemIndex != null)
      return `Menu item ${e.menuItemIndex + 1}: ${e.message}`;
    return e.message;
  };

  const formatResultError = (e: PagesImportResult['errors'][number]) => {
    if (e.pageIndex != null) return `Page ${e.pageIndex + 1}: ${e.error}`;
    if (e.menuItemIndex != null)
      return `Menu item ${e.menuItemIndex + 1}: ${e.error}`;
    return e.error;
  };

  const buildPageRows = (): PageReviewRow[] => {
    if (!parsedPages) return [];
    const rows = parsedPages.map((p, index) => {
      const hasExisting =
        importMode === 'skip' && existingForReview
          ? existingForReview.existingPageSlugs.has(p.slug)
          : false;
      const hasConflict =
        validation?.errors.some((e) => e.pageIndex === index) ?? false;
      const hasWarning =
        validation?.warnings?.some((w) => w.pageIndex === index) ?? false;
      return {
        id: `page-${index}`,
        index,
        slug: p.slug,
        title: p.title,
        parentSlug: p.parent_slug ?? null,
        hasExisting,
        hasConflict,
        hasWarning,
      };
    });
    if (importMode === 'skip' && existingForReview) {
      return rows.filter((r) => !r.hasExisting);
    }
    return rows;
  };

  const buildMenuRows = (): MenuReviewRow[] => {
    if (!parsedMenuItems) return [];
    const rows = parsedMenuItems.map((m, index) => {
      const menuKey = `${m.menu_location}:${m.key}`;
      const hasExisting =
        importMode === 'skip' && existingForReview
          ? existingForReview.existingMenuKeys.has(menuKey)
          : false;
      const hasConflict =
        validation?.errors.some((e) => e.menuItemIndex === index) ?? false;
      const hasWarning =
        validation?.warnings?.some((w) => w.menuItemIndex === index) ?? false;
      return {
        id: `menu-${index}`,
        index,
        location: m.menu_location,
        label: m.label,
        key: m.key,
        parentKey: m.parent_key,
        pageSlug: m.page_slug,
        hasExisting,
        hasConflict,
        hasWarning,
      };
    });
    if (importMode === 'skip' && existingForReview) {
      return rows.filter((r) => !r.hasExisting);
    }
    return rows;
  };

  const getStatusForRow = (row: { hasExisting?: boolean; hasConflict?: boolean; hasWarning?: boolean }): ImportRowStatus | null => {
    if (row.hasConflict) return 'conflict';
    if (row.hasWarning) return 'warning';
    if (row.hasExisting) return 'existing';
    return 'new';
  };

  const getPageSearchText = (row: PageReviewRow) =>
    [row.slug, row.title, row.parentSlug].filter(Boolean).join(' ');

  const getMenuSearchText = (row: MenuReviewRow) =>
    [row.location, row.label, row.key, row.parentKey, row.pageSlug]
      .filter(Boolean)
      .join(' ');

  const handleDownloadResult = () => {
    if (!importResult) return;
    const blob = new Blob([JSON.stringify(importResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `pages-menu-import-result-${datePart}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Pages &amp; Menu</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Select JSON File</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="pages-import-file"
                  disabled={isImporting || isValidating}
                />
                <label htmlFor="pages-import-file">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={isImporting || isValidating}
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {file ? file.name : 'Choose File'}
                    </span>
                  </Button>
                </label>
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      setValidation(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={isImporting || isValidating}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {isValidating && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Validating file...</span>
              </div>
            )}

            {validation && (
              <div className="space-y-2">
                <div
                  className={`flex items-center gap-2 ${validation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {validation.valid ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {validation.valid ? 'File is valid' : 'Validation failed'}
                  </span>
                </div>

                {hasErrors && validation.errors.length > 0 && (
                  <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-medium text-sm">Errors:</div>
                        <ScrollArea className="max-h-32">
                          <ul className="text-sm space-y-1">
                            {validation.errors.map((error, idx) => (
                              <li
                                key={idx}
                                className="text-red-600 dark:text-red-400"
                              >
                                {formatValidationError(error)}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {hasWarnings && validation.warnings && validation.warnings.length > 0 && (
                  <Card className="border-yellow-200 dark:border-yellow-800">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Warnings:
                        </div>
                        <ScrollArea className="max-h-32">
                          <ul className="text-sm space-y-1 text-yellow-700 dark:text-yellow-300">
                            {validation.warnings.map((warning, idx) => (
                              <li key={idx}>
                                {warning.pageIndex != null
                                  ? `Page ${warning.pageIndex + 1}: `
                                  : ''}
                                {warning.menuItemIndex != null
                                  ? `Menu item ${warning.menuItemIndex + 1}: `
                                  : ''}
                                {warning.message}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {validation.valid && file && (pageCount > 0 || menuCount > 0) && (
                  <div className="text-sm text-muted-foreground">
                    Found {pageCount} page{pageCount !== 1 ? 's' : ''},{' '}
                    {menuCount} menu item{menuCount !== 1 ? 's' : ''} to import
                  </div>
                )}
              </div>
            )}

            {validation?.valid && step === 'options' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">How should we handle existing pages and menu items?</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose what happens when the import finds pages or menu items that already exist in your site.
                  </p>
                </div>
                <RadioGroup
                  value={importMode}
                  onValueChange={(v) => setImportMode(v as PagesImportMode)}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <label
                    htmlFor="pm-skip"
                    className={cn(
                      'relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all duration-200 hover:border-primary/50',
                      importMode === 'skip'
                        ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                        : 'border-border bg-card'
                    )}
                  >
                    <RadioGroupItem value="skip" id="pm-skip" className="sr-only" />
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-foreground">Skip Existing</span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      Only add new items. Leave your current pages and menu items unchanged—safest choice when you want to add content without touching what&apos;s already there.
                    </span>
                  </label>
                  <label
                    htmlFor="pm-overwrite"
                    className={cn(
                      'relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all duration-200 hover:border-primary/50',
                      importMode === 'overwrite'
                        ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                        : 'border-border bg-card'
                    )}
                  >
                    <RadioGroupItem value="overwrite" id="pm-overwrite" className="sr-only" />
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-foreground">Overwrite</span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      Replace existing items with the imported data. Your current version will be completely replaced—use when the import file is your source of truth.
                    </span>
                  </label>
                  <label
                    htmlFor="pm-merge"
                    className={cn(
                      'relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all duration-200 hover:border-primary/50',
                      importMode === 'merge'
                        ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                        : 'border-border bg-card'
                    )}
                  >
                    <RadioGroupItem value="merge" id="pm-merge" className="sr-only" />
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <GitMerge className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-foreground">Merge</span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      Combine imported data with existing items. New fields from the import are added, while keeping your current values where no conflict exists.
                    </span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {validation?.valid && step === 'review' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>
                    Pages to import
                    {importMode === 'skip' && existingForReview && pageCount > buildPageRows().length && (
                      <span className="text-muted-foreground font-normal ml-2">
                        (showing {buildPageRows().length} new, {pageCount - buildPageRows().length} existing hidden)
                      </span>
                    )}
                  </Label>
                  <ImportReviewTree<PageReviewTreeNode>
                    treeNodes={buildPageReviewTree(buildPageRows())}
                    totalCount={buildPageRows().length}
                    selectedIds={selectedPageIds}
                    onSelectionChange={setSelectedPageIds}
                    columns={[
                      {
                        key: 'slug',
                        header: 'Slug',
                        render: (node) => node.slug,
                      },
                      {
                        key: 'title',
                        header: 'Title',
                        render: (node) => node.title,
                      },
                      {
                        key: 'parent',
                        header: 'Parent slug',
                        render: (node) => node.parentSlug ?? '—',
                      },
                    ]}
                    getRowStatus={(node) => getStatusForRow(node)}
                    getSearchText={(node) =>
                      [node.slug, node.title, node.parentSlug].filter(Boolean).join(' ')
                    }
                    entityLabel="pages"
                    sortOptions={[
                      { value: 'default' as SortOption, label: 'Default (hierarchy)' },
                      { value: 'slug-asc' as SortOption, label: 'Slug A→Z' },
                      { value: 'title-asc' as SortOption, label: 'Title A→Z' },
                    ]}
                    getSortKey={(node, opt) =>
                      opt === 'slug-asc' ? node.slug : node.title
                    }
                    scrollHeight="min-h-[240px] max-h-[50vh]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Menu items to import
                    {importMode === 'skip' && existingForReview && menuCount > buildMenuRows().length && (
                      <span className="text-muted-foreground font-normal ml-2">
                        (showing {buildMenuRows().length} new, {menuCount - buildMenuRows().length} existing hidden)
                      </span>
                    )}
                  </Label>
                  <MenuItemsReviewTabs
                    menuRows={buildMenuRows()}
                    selectedMenuIds={selectedMenuIds}
                    setSelectedMenuIds={setSelectedMenuIds}
                    getStatusForRow={getStatusForRow}
                    menuCount={buildMenuRows().length}
                  />
                </div>
              </div>
            )}

            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    Importing {selectedPageIds.length + selectedMenuIds.length} selected item{selectedPageIds.length + selectedMenuIds.length !== 1 ? 's' : ''}...
                  </span>
                </div>
                <Progress value={undefined} className="w-full" />
              </div>
            )}

            {importResult && (
              <Card
                className={
                  importResult.success
                    ? 'border-green-200 dark:border-green-800'
                    : 'border-red-200 dark:border-red-800'
                }
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div
                      className={`flex items-center gap-2 font-medium ${importResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {importResult.success ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                      <span>
                        Import {importResult.success ? 'Completed' : 'Failed'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Selected: {importResult.total}</div>
                      <div className="text-green-600 dark:text-green-400">
                        Imported: {importResult.imported}
                      </div>
                      {importResult.overwritten > 0 && (
                        <div className="text-blue-600 dark:text-blue-400">
                          Overwritten: {importResult.overwritten}
                        </div>
                      )}
                      {importResult.skipped > 0 && (
                        <div className="text-yellow-600 dark:text-yellow-400">
                          Skipped: {importResult.skipped}
                        </div>
                      )}
                      {importResult.failed > 0 && (
                        <div className="text-red-600 dark:text-red-400">
                          Failed: {importResult.failed}
                        </div>
                      )}
                    </div>

                    {importResult.errors.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-medium text-sm">Errors:</div>
                        <ScrollArea className="max-h-32">
                          <ul className="text-sm space-y-1">
                            {importResult.errors.map((error, idx) => (
                              <li
                                key={idx}
                                className="text-red-600 dark:text-red-400"
                              >
                                {formatResultError(error)}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadResult}
                      >
                        Download result JSON
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'options') {
                  setStep('upload');
                } else if (step === 'review') {
                  setExistingForReview(null);
                  setStep('options');
                } else {
                  handleClose();
                }
              }}
              disabled={isImporting}
            >
            {importResult ? 'Close' : step === 'options' || step === 'review' ? 'Back' : 'Cancel'}
          </Button>
          {!importResult && step === 'upload' && validation?.valid && (
            <Button onClick={() => setStep('options')}>
              Continue
            </Button>
          )}
          {!importResult && step === 'options' && (
            <Button
              onClick={handleContinueToReview}
              disabled={loadingExisting}
            >
              {loadingExisting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking existing...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          )}
          {!importResult && step === 'review' && (
            <Button onClick={handleImport} disabled={!canImport}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Selected Items'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
