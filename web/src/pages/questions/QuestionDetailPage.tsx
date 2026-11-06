import { ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Skeleton, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { getQuestion } from '@/api/questions';
import { ErrorState, PageShell } from '@/components/common';
import { Markdown } from '@/features/chat/markdown';
import { AttemptList } from '@/features/questions/AttemptList';
import { formatDateTime } from '@/lib/format';

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
      <PageShell>
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageShell>
    );
  }

  if (questionQuery.isError || !questionQuery.data) {
    return (
      <PageShell>
        <ErrorState
          title="题目加载失败"
          message={toErrorMessage(questionQuery.error, '题目可能已被删除')}
          onRetry={() => void questionQuery.refetch()}
        />
      </PageShell>
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
    <PageShell>
      <div className="mx-auto w-full max-w-[820px]">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-chip py-1.5 text-sm text-ink-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => navigate('/questions')}
          >
            <ArrowLeftOutlined aria-hidden="true" />
            返回题库
          </button>
        </div>

        <article className="rounded-panel border border-line bg-surface p-7 shadow-[0_1px_2px_rgb(16_23_32/4%)] max-[767px]:p-4">
          <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 text-xs leading-[22px] ${
                  isSingleChoice ? 'bg-brand-soft text-brand' : 'bg-surface-sunken text-ink-muted'
                }`}
              >
                {isSingleChoice ? '单选题' : '简答题'}
              </span>
              {question.user_id ? null : (
                <span className="inline-flex items-center rounded-full border border-line px-2.5 text-xs leading-[22px] text-ink-muted">
                  公共题
                </span>
              )}
            </div>
            <span className="data-text text-ink-subtle">
              创建于 {formatDateTime(question.created_at)}
            </span>
          </div>

          <Markdown
            content={question.stem}
            className="text-base leading-[1.85] max-[767px]:text-[15px]"
          />

          {options.length > 0 ? (
            <ol className="m-0 mt-5 flex list-none flex-col gap-2 p-0">
              {options.map(([letter, text]) => (
                <li
                  key={letter}
                  className="flex items-start gap-3 rounded-card border border-line bg-surface px-3.5 py-2.5"
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-code text-xs leading-none text-ink-muted">
                    {letter}
                  </span>
                  <span className="text-[15px] leading-relaxed">{text}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {question.note ? (
            <Alert
              className="mt-5"
              type="info"
              showIcon
              message="备注"
              description={question.note}
            />
          ) : null}

          <section className="mt-6 border-t border-line pt-5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold tracking-[0.02em] text-ink-muted">
                参考答案
              </span>
              {question.answer_text ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-chip px-2 py-1 text-xs text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => void copyAnswer()}
                >
                  <CopyOutlined aria-hidden="true" />
                  复制
                </button>
              ) : null}
            </div>
            {question.answer_text ? (
              <div className="whitespace-pre-wrap rounded-chip border-l-[3px] border-brand bg-brand-soft px-4 py-3.5 text-[14.5px] leading-[1.8] text-ink [overflow-wrap:anywhere]">
                {question.answer_text}
              </div>
            ) : (
              <Typography.Text type="secondary">暂无参考答案</Typography.Text>
            )}
          </section>
        </article>

        <AttemptList questionId={question.id} />
      </div>
    </PageShell>
  );
}
