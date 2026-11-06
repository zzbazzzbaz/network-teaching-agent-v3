import { MessageOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { Link } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { listAttempts } from '@/api/questions';
import { EmptyState, ErrorState } from '@/components/common';
import { formatDateTime } from '@/lib/format';

import styles from './AttemptList.module.css';

export function AttemptList({ questionId }: { questionId: string }) {
  const attemptsQuery = useQuery({
    queryKey: ['question-attempts', questionId],
    queryFn: () => listAttempts(questionId, 50, 0),
    retry: false,
  });

  const attempts = attemptsQuery.data?.items ?? [];
  const total = attemptsQuery.data?.total ?? 0;

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className="section-title">作答记录</h2>
        {attemptsQuery.data ? (
          <span className={`data-text ${styles.count}`}>{total} 次</span>
        ) : null}
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
        <ol className={styles.list}>
          {attempts.map((attempt, index) => (
            <li key={attempt.id} className={styles.item}>
              <div className={styles.meta}>
                <span className={styles.index}>第 {total - index} 次</span>
                <span className="data-text">{formatDateTime(attempt.created_at)}</span>
                <Link to={`/chat/${attempt.session_id}`} className={styles.sessionLink}>
                  <MessageOutlined aria-hidden="true" />
                  查看会话
                </Link>
              </div>
              <p className={styles.text}>{attempt.answer_text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
