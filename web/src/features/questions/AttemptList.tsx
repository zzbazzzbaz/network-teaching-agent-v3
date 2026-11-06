import { MessageOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { Link } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { listAttempts } from '@/api/questions';
import { EmptyState, ErrorState } from '@/components/common';
import { formatDateTime } from '@/lib/format';

export function AttemptList({ questionId }: { questionId: string }) {
  const attemptsQuery = useQuery({
    queryKey: ['question-attempts', questionId],
    queryFn: () => listAttempts(questionId, 50, 0),
    retry: false,
  });

  const attempts = attemptsQuery.data?.items ?? [];
  const total = attemptsQuery.data?.total ?? 0;

  return (
    <section className="mt-7">
      <header className="mb-3 flex items-baseline gap-2">
        <h2 className="m-0 text-base font-semibold leading-normal">作答记录</h2>
        {attemptsQuery.data ? <span className="data-text text-ink-subtle">{total} 次</span> : null}
      </header>

      {attemptsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : attemptsQuery.isError ? (
        <ErrorState
          title="作答记录加载失败"
          message={toErrorMessage(attemptsQuery.error, '请稍后重试')}
          onRetry={() => void attemptsQuery.refetch()}
          compact
        />
      ) : attempts.length === 0 ? (
        <EmptyState title="还没有作答记录" description="在对话里完成这道题后，作答会记录在这里。" />
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {attempts.map((attempt, index) => (
            <li
              key={attempt.id}
              className="rounded-card border border-line bg-surface px-4 py-3.5 transition-colors hover:border-[#d3dbe3]"
            >
              <div className="mb-2 flex items-center gap-2.5 text-ink-subtle max-[767px]:flex-wrap max-[767px]:gap-y-1">
                <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 font-code text-xs leading-relaxed text-brand">
                  第 {total - index} 次
                </span>
                <span className="data-text">{formatDateTime(attempt.created_at)}</span>
                <Link
                  to={`/chat/${attempt.session_id}`}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-brand max-[767px]:ml-0"
                >
                  <MessageOutlined aria-hidden="true" />
                  查看会话
                </Link>
              </div>
              <p className="m-0 whitespace-pre-wrap text-sm leading-[1.7] [overflow-wrap:anywhere]">
                {attempt.answer_text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
