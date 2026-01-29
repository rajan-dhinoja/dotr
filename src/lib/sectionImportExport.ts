import type { PageSection } from '@/hooks/usePageSections';
import type { Json } from '@/integrations/supabase/types';
import { validateJson, coerceContentForSchema } from './sectionSchemaUtils';

/**
 * Section export data structure
 */
export interface SectionExportData {
  version: string;
  exported_at: string;
  entity_type: 'page_section';
  page_type: string;
  entity_id?: string | null;
  sections: Array<Partial<PageSection>>;
}

/**
 * Validation result for section import
 */
export interface SectionValidationResult {
  valid: boolean;
  errors: Array<{
    sectionIndex?: number;
    path: string;
    message: string;
  }>;
  warnings?: Array<{
    sectionIndex?: number;
    path: string;
    message: string;
  }>;
}

/**
 * Export sections to a JSON file
 */
export function exportSectionsToFile(
  sections: PageSection[],
  pageType: string,
  entityId?: string | null
): void {
  const exportData: SectionExportData = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    entity_type: 'page_section',
    page_type: pageType,
    entity_id: entityId || null,
    sections: sections.map((section) => ({
      id: section.id,
      section_type: section.section_type,
      title: section.title,
      subtitle: section.subtitle,
      content: section.content,
      display_order: section.display_order,
      is_active: section.is_active,
    })),
  };

  const formatted = JSON.stringify(exportData, null, 2);
  const blob = new Blob([formatted], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const pageTypeSlug = pageType.replace(/\s+/g, '-').toLowerCase();
  const entitySuffix = entityId ? `-${entityId.slice(0, 8)}` : '';
  link.download = `page-sections-${pageTypeSlug}${entitySuffix}-${new Date().toISOString().split('T')[0]}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse section import file
 */
export function parseSectionImportFile(file: File): Promise<SectionExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as SectionExportData;
        
        // Validate structure
        if (!parsed.version || !parsed.entity_type || !Array.isArray(parsed.sections)) {
          reject(new Error('Invalid import file format. Expected version, entity_type, and sections array.'));
          return;
        }
        
        if (parsed.entity_type !== 'page_section') {
          reject(new Error('Invalid entity type. Expected page_section.'));
          return;
        }
        
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Validate section import data structure and content
 */
export async function validateSectionImportData(
  data: SectionExportData,
  pageType: string,
  sectionTypes: Array<{ slug: string; schema: Json; is_active: boolean }>
): Promise<SectionValidationResult> {
  const errors: Array<{ sectionIndex?: number; path: string; message: string }> = [];
  const warnings: Array<{ sectionIndex?: number; path: string; message: string }> = [];

  // Validate root structure
  if (!data.page_type) {
    errors.push({ path: '/', message: 'Missing page_type field' });
  } else if (data.page_type !== pageType) {
    warnings.push({
      path: '/page_type',
      message: `Page type mismatch. File contains "${data.page_type}", importing to "${pageType}". Sections will be imported to the current page.`,
    });
  }

  if (!data.sections || !Array.isArray(data.sections)) {
    errors.push({ path: '/', message: 'Missing or invalid sections array' });
    return { valid: false, errors, warnings };
  }

  if (data.sections.length === 0) {
    errors.push({ path: '/', message: 'Import file contains no sections' });
    return { valid: false, errors, warnings };
  }

  // Validate each section
  for (let i = 0; i < data.sections.length; i++) {
    const section = data.sections[i];
    const sectionPath = `/sections[${i}]`;

    // Required fields
    if (!section.section_type || typeof section.section_type !== 'string') {
      errors.push({
        sectionIndex: i,
        path: `${sectionPath}/section_type`,
        message: 'Missing or invalid section_type',
      });
      continue; // Skip further validation for this section
    }

    // Check if section type exists and is active
    const sectionType = sectionTypes.find(st => st.slug === section.section_type);
    if (!sectionType) {
      errors.push({
        sectionIndex: i,
        path: `${sectionPath}/section_type`,
        message: `Section type "${section.section_type}" does not exist`,
      });
      continue;
    }

    if (!sectionType.is_active) {
      warnings.push({
        sectionIndex: i,
        path: `${sectionPath}/section_type`,
        message: `Section type "${section.section_type}" is not active`,
      });
    }

    // Validate content structure
    if (section.content !== undefined && section.content !== null) {
      if (typeof section.content !== 'object') {
        errors.push({
          sectionIndex: i,
          path: `${sectionPath}/content`,
          message: 'Content must be an object',
        });
      } else {
        // Coerce content to match schema types (e.g. string "3" -> number 3 for count)
        const contentObj = section.content as Record<string, unknown>;
        section.content = coerceContentForSchema(contentObj, sectionType.schema) as Json;
        // Validate content against schema
        const validation = validateJson(section.content as Json, sectionType.schema);
        if (!validation.valid && validation.errors.length > 0) {
          validation.errors.forEach((error) => {
            errors.push({
              sectionIndex: i,
              path: `${sectionPath}/content${error.path}`,
              message: error.message,
            });
          });
        }
      }
    }

    // Validate display_order if present
    if (section.display_order !== undefined && typeof section.display_order !== 'number') {
      errors.push({
        sectionIndex: i,
        path: `${sectionPath}/display_order`,
        message: 'display_order must be a number',
      });
    }

    // Validate is_active if present
    if (section.is_active !== undefined && typeof section.is_active !== 'boolean') {
      errors.push({
        sectionIndex: i,
        path: `${sectionPath}/is_active`,
        message: 'is_active must be a boolean',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
