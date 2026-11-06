import { ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Skeleton, Tag, Typography } from 'antd';
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
  const { message } = App.useApp();

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
  const isSingleChoice = question.question_type === 'single_choice';

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(question.answer_text);
      message.success('已复制参考答案');
    } catch {
      message.error('复制失败，请手动选择文本');
    }
  };

  return (
    <div className="page-shell">
      <div className={styles.container}>
        <div className={styles.topbar}>
          <Button
            type="text"
            className={styles.back}
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/questions')}
          >
            返回题库
          </Button>
        </div>

        <article className={styles.article}>
          <div className={styles.meta}>
            <div className={styles.badges}>
              <Tag
                bordered={false}
                className={`${styles.badge} ${isSingleChoice ? styles.badgeBrand : styles.badgeMuted}`}
              >
                {isSingleChoice ? '单选题' : '简答题'}
              </Tag>
              {question.user_id ? null : (
                <Tag bordered={false} className={`${styles.badge} ${styles.badgeOutline}`}>
                  公共题
                </Tag>
              )}
            </div>
            <span className={`data-text ${styles.createdAt}`}>
              创建于 {formatDateTime(question.created_at)}
            </span>
          </div>

          <Markdown content={question.stem} className={styles.stem} />

          {options.length > 0 ? (
            <ol className={styles.options}>
              {options.map(([letter, text]) => (
                <li key={letter} className={styles.option}>
                  <span className={styles.optionLetter}>{letter}</span>
                  <span className={styles.optionText}>{text}</span>
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

          <section className={styles.answerBlock}>
            <div className={styles.answerHeader}>
              <span className={styles.sectionLabel}>参考答案</span>
              {question.answer_text ? (
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  className={styles.copy}
                  onClick={() => void copyAnswer()}
                >
                  复制
                </Button>
              ) : null}
            </div>
            {question.answer_text ? (
              <div className={styles.answer}>{question.answer_text}</div>
            ) : (
              <Typography.Text type="secondary">暂无参考答案</Typography.Text>
            )}
          </section>
        </article>

        <AttemptList questionId={question.id} />
      </div>
    </div>
  );
}
