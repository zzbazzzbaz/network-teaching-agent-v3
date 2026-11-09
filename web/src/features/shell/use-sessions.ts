import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCallback } from 'react';

import { toErrorMessage } from '@/api/client';
import { createSession, deleteSession, listSessions } from '@/api/sessions';
import type { SessionItem, SessionListResponse } from '@/api/types';

const PAGE_SIZE = 20;
export const SESSIONS_QUERY_KEY = ['sessions'] as const;

export interface UseSessionsResult {
  items: SessionItem[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  refetch: () => void;
  loadMore: () => void;
  create: () => Promise<SessionItem | null>;
  remove: (sessionId: string) => Promise<boolean>;
}

export function useSessions(): UseSessionsResult {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const query = useInfiniteQuery({
    queryKey: SESSIONS_QUERY_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listSessions({ limit: PAGE_SIZE, offset: pageParam as number }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (created) => {
      queryClient.setQueryData<{ pages: SessionListResponse[]; pageParams: number[] }>(
        SESSIONS_QUERY_KEY,
        (current) => {
          if (!current) {
            return current;
          }
          const [first, ...rest] = current.pages;
          if (!first) {
            return current;
          }
          return {
            ...current,
            pages: [
              { ...first, items: [created, ...first.items], total: first.total + 1 },
              ...rest,
            ],
          };
        },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.setQueryData<{ pages: SessionListResponse[]; pageParams: number[] }>(
        SESSIONS_QUERY_KEY,
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== sessionId),
                  total: Math.max(page.total - 1, 0),
                })),
              }
            : current,
      );
    },
  });

  const create = useCallback(async () => {
    try {
      return await createMutation.mutateAsync();
    } catch (error) {
      message.error(toErrorMessage(error, '新建会话失败'));
      return null;
    }
  }, [createMutation, message]);

  const remove = useCallback(
    async (sessionId: string) => {
      try {
        await deleteMutation.mutateAsync(sessionId);
        return true;
      } catch (error) {
        message.error(toErrorMessage(error, '删除会话失败'));
        return false;
      }
    },
    [deleteMutation, message],
  );

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    items,
    total,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    refetch: () => void query.refetch(),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    create,
    remove,
  };
}
