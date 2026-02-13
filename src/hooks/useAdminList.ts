import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildListQuery, buildCountQuery } from '@/lib/admin/queryBuilder';
import { useDebounce } from './useDebounce';
import type {
  UseAdminListOptions,
  UseAdminListResult,
  BaseEntity,
  SortConfig,
} from '@/lib/types/admin';

/**
 * Generic hook for admin list views with search, sort, filter, and pagination
 */
export function useAdminList<T extends BaseEntity>(
  options: UseAdminListOptions<T>
): UseAdminListResult<T> {
  const {
    tableName,
    queryKey,
    columns = '*',
    defaultSort,
    defaultFilters = {},
    pageSize = 20,
    enabled = true,
    searchFields = [],
  } = options;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(
    defaultSort ? { field: defaultSort.field, direction: defaultSort.direction } : null
  );
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);
  const [page, setPage] = useState(1);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset to page 1 when search changes so results are visible
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Build query options
  const queryOptions = useMemo(
    () => ({
      search: debouncedSearch,
      searchFields,
      sort: sortConfig || undefined,
      filters,
      page,
      pageSize,
    }),
    [debouncedSearch, searchFields, sortConfig, filters, page, pageSize]
  );

  // Fetch data
  const {
    data: queryData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKey, queryOptions],
    queryFn: async () => {
      const baseQuery = (supabase.from as any)(tableName).select(columns);
      const listQuery = buildListQuery(baseQuery, queryOptions);
      const { data, error: queryError } = await listQuery;

      if (queryError) throw queryError;

      return data as T[];
    },
    enabled: enabled && !!tableName,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch count for pagination
  const { data: countData } = useQuery({
    queryKey: [...queryKey, 'count', { search: debouncedSearch, searchFields, filters }],
    queryFn: async () => {
      const baseQuery = (supabase.from as any)(tableName).select('*', { count: 'exact', head: true });
      const countQuery = buildCountQuery(baseQuery, {
        search: debouncedSearch,
        searchFields,
        filters,
      });
      const { count, error: countError } = await countQuery;

      if (countError) throw countError;

      return count || 0;
    },
    enabled: enabled && !!tableName,
    staleTime: 30 * 1000,
  });

  const data = queryData || [];
  const totalCount = countData || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Helper functions
  const clearFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  const setFilter = (key: string, value: any) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value === null || value === undefined || value === '' || value === 'all') {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      return newFilters;
    });
    setPage(1); // Reset to first page when filter changes
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const nextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const previousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  return {
    data,
    isLoading,
    error: error as Error | null,
    totalCount,
    page,
    pageSize,
    totalPages,
    searchQuery,
    setSearchQuery,
    sortConfig,
    setSortConfig,
    filters,
    setFilter,
    clearFilters,
    refetch,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    goToPage,
    nextPage,
    previousPage,
  };
}
