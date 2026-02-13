/**
 * Applies filters to a Supabase query
 */
export function applyFilters<T>(
  query: any,
  filters: Record<string, any> | undefined
): any {
  if (!filters || Object.keys(filters).length === 0) {
    return query;
  }

  let filteredQuery = query;

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '' || value === 'all') {
      continue;
    }

    // Sentinel for "filter by null" (e.g. Manual page type)
    if (value === '__null__') {
      filteredQuery = filteredQuery.is(key, null);
      continue;
    }

    // Handle boolean filters
    if (typeof value === 'boolean') {
      filteredQuery = filteredQuery.eq(key, value);
    }
    // Handle string filters (including 'true'/'false' strings)
    else if (typeof value === 'string') {
      if (value === 'true') {
        filteredQuery = filteredQuery.eq(key, true);
      } else if (value === 'false') {
        filteredQuery = filteredQuery.eq(key, false);
      } else {
        filteredQuery = filteredQuery.eq(key, value);
      }
    }
    // Handle array filters (for multiselect)
    else if (Array.isArray(value)) {
      if (value.length > 0) {
        filteredQuery = filteredQuery.in(key, value);
      }
    }
    // Handle date range filters
    else if (typeof value === 'object' && value !== null) {
      if ('from' in value && value.from) {
        filteredQuery = filteredQuery.gte(key, value.from);
      }
      if ('to' in value && value.to) {
        filteredQuery = filteredQuery.lte(key, value.to);
      }
    }
    // Default: equality filter
    else {
      filteredQuery = filteredQuery.eq(key, value);
    }
  }

  return filteredQuery;
}
