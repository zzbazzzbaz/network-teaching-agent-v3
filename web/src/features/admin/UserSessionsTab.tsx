import { useQuery } from '@tanstack/react-query';
import { Input, List, Pagination, Skeleton, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { listUserSessions } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import { EmptyState, ErrorState } from '@/components/common';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

export function UserSessionsTab({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

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
                  onClick={() => navigate(`/admin/users/${userId}/sessions/${item.id}`)}
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
    </div>
  );
}
