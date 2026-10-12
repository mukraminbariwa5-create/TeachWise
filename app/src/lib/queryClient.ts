import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';

/** The one data cache for the whole app (shared so log out can clear it). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 3600 * 1000,
      // Don't retry "not allowed" or validation errors, only network hiccups.
      retry: (count: number, error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      // When offline, show saved data instead of an error.
      networkMode: 'offlineFirst',
    },
  },
});
