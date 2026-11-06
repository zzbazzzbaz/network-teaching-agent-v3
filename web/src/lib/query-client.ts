import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

const isDev = import.meta.env.DEV;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isDev ? 0 : 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: isDev,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export function createQueryClient(): QueryClient {
  return queryClient;
}
