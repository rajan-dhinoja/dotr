import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PageSection, SectionType } from '@/hooks/usePageSections';
import { exportSectionsToFile, parseSectionImportFile, validateSectionImportData } from '@/lib/sectionImportExport';
import { logJsonImport, logJsonExport } from '@/lib/entityJson/audit';

export interface ImportOptions {
  onConflict?: 'skip' | 'overwrite' | 'merge';
  reorderStrategy?: 'preserve' | 'append' | 'renumber';
  validateSchemas?: boolean;
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  overwritten: number;
  failed: number;
  errors: Array<{ sectionIndex: number; error: string }>;
}

interface UseSectionImportExportOptions {
  pageType: string;
  entityId?: string;
  queryKey: string[];
}

/**
 * Deep merge utility for JSONB content
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Hook for section import/export functionality
 */
export function useSectionImportExport({
  pageType,
  entityId,
  queryKey,
}: UseSectionImportExportOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Export all sections for the current page
   */
  const exportSections = useCallback(async (sections: PageSection[]) => {
    try {
      exportSectionsToFile(sections, pageType, entityId);
      await logJsonExport('page_section', sections.length);
      toast({
        title: 'Sections exported',
        description: `${sections.length} section${sections.length !== 1 ? 's' : ''} exported successfully`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export sections',
        variant: 'destructive',
      });
    }
  }, [pageType, entityId, toast]);

  /**
   * Import sections from a file
   */
  const importSections = useCallback(async (
    file: File,
    sectionTypes: SectionType[],
    options: ImportOptions = {}
  ): Promise<ImportResult> => {
    const {
      onConflict = 'skip',
      reorderStrategy = 'append',
      validateSchemas = true,
    } = options;

    try {
      // Parse file
      const importData = await parseSectionImportFile(file);

      // Validate structure and schemas
      const validation = await validateSectionImportData(
        importData,
        pageType,
        sectionTypes.map(st => ({
          slug: st.slug,
          schema: st.schema,
          is_active: st.is_active,
        }))
      );

      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => 
          e.sectionIndex !== undefined 
            ? `Section ${e.sectionIndex + 1}: ${e.message}`
            : e.message
        ).join('; ');
        
        toast({
          title: 'Validation failed',
          description: errorMessages,
          variant: 'destructive',
        });

        return {
          success: false,
          total: importData.sections.length,
          imported: 0,
          skipped: 0,
          overwritten: 0,
          failed: importData.sections.length,
          errors: validation.errors.map(e => ({
            sectionIndex: e.sectionIndex ?? -1,
            error: e.message,
          })),
        };
      }

      // Show warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        const warningMessages = validation.warnings.map(w => 
          w.sectionIndex !== undefined 
            ? `Section ${w.sectionIndex + 1}: ${w.message}`
            : w.message
        ).join('; ');
        
        toast({
          title: 'Import warnings',
          description: warningMessages,
          variant: 'default',
        });
      }

      // Get existing sections to check for conflicts
      let query = supabase
        .from('page_sections')
        .select('*')
        .eq('page_type', pageType)
        .order('display_order');

      if (entityId) {
        query = query.eq('entity_id', entityId);
      } else {
        query = query.is('entity_id', null);
      }

      const { data: existingSections = [] } = await query;
      const maxDisplayOrder = existingSections.length > 0
        ? Math.max(...existingSections.map(s => s.display_order ?? 0))
        : -1;

      // Track results
      let imported = 0;
      let skipped = 0;
      let overwritten = 0;
      let failed = 0;
      const errors: Array<{ sectionIndex: number; error: string }> = [];
      const createdSectionIds: string[] = [];

      // Normalize title for matching (treat null, undefined, '' as equivalent)
      const norm = (v: string | null | undefined) => (v == null || v === '' ? null : v);

      // Process each section
      for (let i = 0; i < importData.sections.length; i++) {
        const sectionData = importData.sections[i];
        
        try {
          // Find existing section: first by id, then by section_type + title (for all modes including skip)
          let existingSection: PageSection | undefined;
          
          if (sectionData.id) {
            existingSection = existingSections.find(s => s.id === sectionData.id);
          }
          if (!existingSection) {
            existingSection = existingSections.find(s =>
              s.section_type === sectionData.section_type &&
              norm(s.title) === norm(sectionData.title)
            );
          }

          // Handle conflicts
          if (existingSection) {
            if (onConflict === 'skip') {
              skipped++;
              continue;
            } else if (onConflict === 'overwrite') {
              // Update existing section
              const updateData: Partial<PageSection> = {
                section_type: sectionData.section_type!,
                title: sectionData.title ?? null,
                subtitle: sectionData.subtitle ?? null,
                content: sectionData.content as any,
                is_active: sectionData.is_active ?? true,
              };

              // Handle display_order based on strategy
              if (reorderStrategy === 'preserve' && sectionData.display_order !== undefined) {
                updateData.display_order = sectionData.display_order;
              }

              const { error } = await supabase
                .from('page_sections')
                .update(updateData)
                .eq('id', existingSection.id);

              if (error) throw error;
              overwritten++;
            } else if (onConflict === 'merge') {
              // Merge content
              const mergedContent = deepMerge(
                (existingSection.content as Record<string, unknown>) || {},
                (sectionData.content as Record<string, unknown>) || {}
              );

              const updateData: Partial<PageSection> = {
                title: sectionData.title ?? existingSection.title,
                subtitle: sectionData.subtitle ?? existingSection.subtitle,
                content: mergedContent as any,
                is_active: sectionData.is_active ?? existingSection.is_active,
              };

              const { error } = await supabase
                .from('page_sections')
                .update(updateData)
                .eq('id', existingSection.id);

              if (error) throw error;
              overwritten++;
            }
          } else {
            // Create new section
            let displayOrder: number;
            
            if (reorderStrategy === 'preserve' && sectionData.display_order !== undefined) {
              displayOrder = sectionData.display_order;
            } else if (reorderStrategy === 'append') {
              displayOrder = maxDisplayOrder + 1 + (i - skipped - overwritten);
            } else {
              // renumber - will be handled after all imports
              displayOrder = maxDisplayOrder + 1 + (i - skipped - overwritten);
            }

            const insertData = {
              page_type: pageType,
              entity_id: entityId || null,
              section_type: sectionData.section_type!,
              title: sectionData.title ?? null,
              subtitle: sectionData.subtitle ?? null,
              content: sectionData.content || {},
              display_order: displayOrder,
              is_active: sectionData.is_active ?? true,
            };

            const { data: newSection, error } = await supabase
              .from('page_sections')
              .insert(insertData)
              .select()
              .single();

            if (error) throw error;
            if (newSection) {
              createdSectionIds.push(newSection.id);
            }
            imported++;
          }
        } catch (error) {
          failed++;
          errors.push({
            sectionIndex: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          console.error(`Failed to import section ${i + 1}:`, error);
        }
      }

      // Renumber all sections if strategy is 'renumber'
      if (reorderStrategy === 'renumber') {
        const { data: allSections = [] } = await query;
        const sortedSections = [...allSections].sort((a, b) => 
          (a.display_order ?? 0) - (b.display_order ?? 0)
        );

        for (let i = 0; i < sortedSections.length; i++) {
          await supabase
            .from('page_sections')
            .update({ display_order: i })
            .eq('id', sortedSections[i].id);
        }
      } else if (reorderStrategy === 'preserve') {
        // Recalculate display_orders to avoid gaps
        const { data: allSections = [] } = await query;
        const sortedSections = [...allSections].sort((a, b) => 
          (a.display_order ?? 0) - (b.display_order ?? 0)
        );

        for (let i = 0; i < sortedSections.length; i++) {
          if (sortedSections[i].display_order !== i) {
            await supabase
              .from('page_sections')
              .update({ display_order: i })
              .eq('id', sortedSections[i].id);
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey });

      // Log import
      await logJsonImport('page_section', imported + overwritten, failed);

      // Show result toast
      const totalProcessed = imported + overwritten + skipped;
      const hasErrors = failed > 0 || errors.length > 0;
      
      toast({
        title: 'Import completed',
        description: `${imported} imported, ${overwritten} overwritten, ${skipped} skipped${failed > 0 ? `, ${failed} failed` : ''}`,
        variant: hasErrors ? 'destructive' : 'default',
      });

      return {
        success: !hasErrors,
        total: importData.sections.length,
        imported,
        skipped,
        overwritten,
        failed,
        errors,
      };
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import sections',
        variant: 'destructive',
      });

      return {
        success: false,
        total: 0,
        imported: 0,
        skipped: 0,
        overwritten: 0,
        failed: 0,
        errors: [{ sectionIndex: -1, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }, [pageType, entityId, queryKey, queryClient, toast]);

  return {
    exportSections,
    importSections,
  };
}
