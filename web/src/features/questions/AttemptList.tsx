import { useQuery } from '@tanstack/react-query';
import { Skeleton, Typography } from 'antd';

import { toErrorMessage } from '@/api/client';
import { listAttempts } from '@/api/questions';
import { ErrorState } from '@/components/common';
import { formatDateTime } from '@/lib/format';

import styles from './AttemptList.module.css';

export function AttemptList({ questionId }: { questionId: string }) {
  const attemptsQuery = useQuery({
    queryKey: ['question-attempts', questionId],
    queryFn: () => listAttempts(questionId, 50, 0),
    retry: false,
  });

  if (attemptsQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  if (attemptsQuery.isError) {
    return (
      <ErrorState
        title="作答记录加载失败"
        message={toErrorMessage(attemptsQuery.error, '请稍后重试')}
        onRetry={() => void attemptsQuery.refetch()}
        compact
      />
    );
  }

  if (!attemptsQuery.data || attemptsQuery.data.items.length === 0) {
    return <Typography.Text type="secondary">还没有作答记录。</Typography.Text>;
  }

  return (
    <ul className={styles.list}>
      {attemptsQuery.data.items.map((attempt, index) => (
        <li key={attempt.id}>
          <div className={styles.meta}>
            <span className="data-text">#{index + 1}</span>
            <span className="data-text">{formatDateTime(attempt.created_at)}</span>
            {attempt.tool_call_id ? (
              <span className={styles.toolCall}>工具调用 {attempt.tool_call_id.slice(0, 8)}</span>
            ) : null}
          </div>
          <Typography.Paragraph className={styles.text}>{attempt.answer_text}</Typography.Paragraph>
        </li>
      ))}
    </ul>
  );
}
