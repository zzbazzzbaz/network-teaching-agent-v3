import { useQuery } from '@tanstack/react-query';
import { Card, Skeleton, Typography } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { getUser, getUserSession, listUserMessages } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { ReadonlyMessages } from '@/features/admin';
import { formatDateTime } from '@/lib/format';

export function AdminSessionDetailPage() {
  const { userId, sessionId } = useParams();
  const navigate = useNavigate();

  const userQuery = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => getUser(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });

  const sessionQuery = useQuery({
    queryKey: ['admin-user-session', userId, sessionId],
    queryFn: () => getUserSession(userId as string, sessionId as string),
    enabled: Boolean(userId) && Boolean(sessionId),
    retry: false,
  });

  const messagesQuery = useQuery({
    queryKey: ['admin-user-messages', userId, sessionId],
    queryFn: () => listUserMessages(userId as string, sessionId as string, undefined, 200),
    enabled: Boolean(userId) && Boolean(sessionId) && sessionQuery.isSuccess,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return (
      <PageShell>
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageShell>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <PageShell>
        <ErrorState
          title="会话加载失败"
          message={toErrorMessage(sessionQuery.error, '会话不存在或已被删除')}
          onRetry={() => void sessionQuery.refetch()}
        />
      </PageShell>
    );
  }

  const session = sessionQuery.data;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[900px]">
        <button
          type="button"
          className="mb-3 inline-flex items-center gap-1.5 rounded-chip py-1.5 text-[12.5px] text-ink-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => navigate(`/admin/users/${userId}?tab=sessions`)}
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          返回学生会话
        </button>

        <Card className="mb-5 border border-line" size="small">
          <Typography.Title level={4} className="mt-0 mb-2">
            {session.title}
          </Typography.Title>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-muted">
            <span>学生：{userQuery.data?.username ?? '\u2014'}</span>
            <span>创建时间：{formatDateTime(session.created_at)}</span>
            <span>最近消息：{formatDateTime(session.last_message_at)}</span>
          </div>
        </Card>

        <section className="rounded-card border border-line bg-surface p-4 max-[767px]:p-3">
          <h2 className="mt-0 mb-4 text-[15px] font-semibold leading-normal tracking-[-0.01em]">会话消息</h2>

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
        </section>
      </div>
    </PageShell>
  );
}
