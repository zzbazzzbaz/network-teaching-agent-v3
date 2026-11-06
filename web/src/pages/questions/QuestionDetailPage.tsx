import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Collapse, Skeleton, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { getQuestion } from '@/api/questions';
import { ErrorState } from '@/components/common';
import { Markdown } from '@/features/chat/markdown';
import { AttemptList } from '@/features/questions/AttemptList';
import { formatDateTime } from '@/lib/format';

import styles from './QuestionDetailPage.module.css';

export function QuestionDetailPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();

  const questionQuery = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => getQuestion(questionId as string),
    enabled: Boolean(questionId),
    retry: false,
  });

  if (questionQuery.isLoading) {
    return (
      <div className="page-shell">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (questionQuery.isError || !questionQuery.data) {
    return (
      <div className="page-shell">
        <ErrorState
          title="题目加载失败"
          message={toErrorMessage(questionQuery.error, '题目可能已被删除')}
          onRetry={() => void questionQuery.refetch()}
        />
      </div>
    );
  }

  const question = questionQuery.data;
  const options = question.options ? Object.entries(question.options) : [];

  return (
    <div className="page-shell">
      <div className={styles.topbar}>
        <Button type="text" onClick={() => navigate('/questions')} className={styles.back}>
          返回题库
        </Button>
        <span className="data-text">{formatDateTime(question.created_at)}</span>
      </div>

      <article className={styles.article}>
        <div className={styles.badges}>
          <Tag>{question.question_type === 'single_choice' ? '单选题' : '简答题'}</Tag>
          {question.user_id ? null : <Tag>公共题</Tag>}
        </div>

        <Markdown content={question.stem} className={styles.stem} />

        {options.length > 0 ? (
          <ol className={styles.options}>
            {options.map(([letter, text]) => (
              <li key={letter}>
                <span className={styles.optionLetter}>{letter}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {question.note ? (
          <Alert
            className={styles.note}
            type="info"
            showIcon
            message="备注"
            description={question.note}
          />
        ) : null}

        <Collapse
          className={styles.collapse}
          items={[
            {
              key: 'answer',
              label: '参考答案',
              children: (
                <Typography.Paragraph
                  className={styles.answer}
                  copyable={{ text: question.answer_text }}
                >
                  {question.answer_text}
                </Typography.Paragraph>
              ),
            },
          ]}
        />
      </article>

      <section className={styles.attempts}>
        <h2 className="section-title">作答记录</h2>
        <AttemptList questionId={question.id} />
      </section>
    </div>
  );
}
