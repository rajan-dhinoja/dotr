import type { QueryBuilderOptions, SortConfig } from '@/lib/types/admin';
import { applySort } from './sortBuilder';
import { applyFilters } from './filterBuilder';

/**
 * Builds a Supabase query with search, sort, filter, and pagination
 */
export function buildListQuery<T>(
  query: any,
  options: QueryBuilderOptions
): any {
  let builtQuery: any = query;

  // Apply search across multiple fields
  if (options.search && options.search.trim() && options.searchFields && options.searchFields.length > 0) {
    const searchTerm = options.search.trim();
    const pattern = `%${searchTerm}%`;
    if (options.searchFields.length === 1) {
      builtQuery = builtQuery.ilike(options.searchFields[0], pattern);
    } else {
      // Supabase .or() format: "field1.ilike.%term%,field2.ilike.%term%"
      const orConditions = options.searchFields
        .map((field) => `${field}.ilike.${pattern}`)
        .join(',');
      builtQuery = builtQuery.or(orConditions);
    }
  }

  // Apply filters
  if (options.filters) {
    builtQuery = applyFilters(builtQuery, options.filters);
  }

  // Apply sorting
  if (options.sort) {
    builtQuery = applySort(builtQuery, options.sort);
  }

  // Apply pagination
  if (options.pageSize) {
    const page = options.page || 1;
    const from = (page - 1) * options.pageSize;
    const to = from + options.pageSize - 1;
    builtQuery = builtQuery.range(from, to);
  }

  return builtQuery;
}

/**
 * Builds a count query for pagination
 */
export function buildCountQuery<T>(
  query: any,
  options: Omit<QueryBuilderOptions, 'sort' | 'page' | 'pageSize'>
): any {
  // Query already has .select('*', { count: 'exact', head: true }) from useAdminList
  let builtQuery: any = query;

  // Apply search (same as buildListQuery)
  if (options.search && options.search.trim() && options.searchFields && options.searchFields.length > 0) {
    const searchTerm = options.search.trim();
    const pattern = `%${searchTerm}%`;
    if (options.searchFields.length === 1) {
      builtQuery = builtQuery.ilike(options.searchFields[0], pattern);
    } else {
      const orConditions = options.searchFields
        .map((field) => `${field}.ilike.${pattern}`)
        .join(',');
      builtQuery = builtQuery.or(orConditions);
    }
  }

  // Apply filters
  if (options.filters) {
    builtQuery = applyFilters(builtQuery, options.filters);
  }

  return builtQuery;
}
