import { useQuery } from '@tanstack/react-query';
import { Drawer, Input, List, Pagination, Skeleton, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { getUserSession, listUserMessages, listUserSessions } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { SessionItem } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common';
import { formatDateTime } from '@/lib/format';

import { ReadonlyMessages } from './ReadonlyMessages';

const PAGE_SIZE = 20;

function SessionMessagesDrawer({
  userId,
  session,
  onClose,
}: {
  userId: string;
  session: SessionItem | null;
  onClose: () => void;
}) {
  const sessionId = session?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ['admin-user-session', userId, sessionId],
    queryFn: () => getUserSession(userId, sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
  });

  const messagesQuery = useQuery({
    queryKey: ['admin-user-messages', userId, sessionId],
    queryFn: () => listUserMessages(userId, sessionId as string, undefined, 200),
    enabled: Boolean(sessionId) && detailQuery.isSuccess,
    retry: false,
  });

  return (
    <Drawer
      open={Boolean(session)}
      size={760}
      title={detailQuery.data?.title ?? session?.title ?? '会话消息'}
      onClose={onClose}
      destroyOnHidden
    >
      {messagesQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : messagesQuery.isError ? (
        <ErrorState
          title="消息加载失败"
          message={toErrorMessage(messagesQuery.error, '对话服务暂不可用')}
          onRetry={() => void messagesQuery.refetch()}
          compact
        />
      ) : (messagesQuery.data?.messages.length ?? 0) === 0 ? (
        <EmptyState title="暂无消息" description="这个会话还没有可展示的消息。" />
      ) : (
        <>
          {messagesQuery.data?.has_more ? (
            <Typography.Text type="secondary" className="mb-4 block text-xs">
              仅展示最近 200 条消息
            </Typography.Text>
          ) : null}
          <ReadonlyMessages messages={messagesQuery.data?.messages ?? []} />
        </>
      )}
    </Drawer>
  );
}

export function UserSessionsTab({ userId }: { userId: string }) {
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<SessionItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sessionsQuery = useQuery({
    queryKey: ['admin-user-sessions', userId, keyword, page],
    queryFn: () =>
      listUserSessions(userId, {
        q: keyword || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  });

  const data = sessionsQuery.data;

  return (
    <div>
      <div className="mb-4">
        <Input.Search
          allowClear
          className="w-[260px] max-[767px]:w-full"
          placeholder="搜索会话标题"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {sessionsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : sessionsQuery.isError ? (
        <ErrorState
          title="会话列表加载失败"
          message={toErrorMessage(sessionsQuery.error, '请稍后重试')}
          onRetry={() => void sessionsQuery.refetch()}
          compact
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="还没有会话" description="该学生尚未开始对话，或会话已被删除。" />
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <List
              dataSource={data.items}
              rowKey="id"
              renderItem={(item) => (
                <List.Item
                  className="cursor-pointer transition-colors hover:bg-surface-sunken/60"
                  style={{ padding: '12px 16px' }}
                  onClick={() => setActive(item)}
                >
                  <div className="w-full">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <span className="data-text text-ink-subtle">
                        {formatDateTime(item.last_message_at)}
                      </span>
                    </div>
                    <div className="text-xs text-ink-subtle">
                      创建于 {formatDateTime(item.created_at)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              showSizeChanger={false}
              onChange={setPage}
            />
          </div>
        </>
      )}

      <SessionMessagesDrawer userId={userId} session={active} onClose={() => setActive(null)} />
    </div>
  );
}
