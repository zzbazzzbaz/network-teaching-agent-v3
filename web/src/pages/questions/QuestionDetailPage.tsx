import { useQuery } from '@tanstack/react-query';
import { App, Skeleton, Tag, Typography } from 'antd';
import { ArrowLeft, Copy, MessageSquare } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { getQuestion } from '@/api/questions';
import { ErrorState, PageShell } from '@/components/common';
import { Markdown } from '@/features/chat/markdown';
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
          title="答题记录加载失败"
          message={toErrorMessage(questionQuery.error, '记录可能已被删除')}
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
      await navigator.clipboard.writeText(question.correct_answer);
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
            className="inline-flex items-center gap-1.5 rounded-chip py-1.5 text-[12.5px] text-ink-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => navigate('/questions')}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回答题记录
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
            </div>
            <div className="flex items-center gap-3 text-ink-subtle">
              <span className="data-text">作答于 {formatDateTime(question.answered_at)}</span>
              <Link
                to={`/chat/${question.session_id}`}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-subtle hover:text-brand"
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                查看会话
              </Link>
            </div>
          </div>

          <Markdown
            content={question.stem}
            className="text-[15px] leading-[1.85]"
          />

          {isSingleChoice && options.length > 0 ? (
            <ol className="m-0 mt-5 flex list-none flex-col gap-2 p-0">
              {options.map(([letter, text]) => {
                const isCorrect = isSingleChoice && question.correct_answer === letter;
                const isPicked = question.student_answer === letter;
                return (
                  <li
                    key={letter}
                    className={`flex items-start gap-3 rounded-card border px-3.5 py-2.5 ${
                      isCorrect ? 'border-brand/40 bg-brand-soft' : 'border-line bg-surface'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-code text-xs leading-none text-ink-muted">
                      {letter}
                    </span>
                    <span className="text-[15px] leading-relaxed">{text}</span>
                    <span className="ml-auto flex shrink-0 gap-1.5">
                      {isPicked ? <Tag>你的选择</Tag> : null}
                      {isCorrect ? <Tag color="success">正确答案</Tag> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <section className="mt-6 border-t border-line pt-5">
            <div className="mb-2.5 text-[13px] font-semibold tracking-[0.02em] text-ink-muted">
              我的答案
            </div>
            <div className="whitespace-pre-wrap rounded-chip bg-surface-sunken px-4 py-3.5 text-[14px] leading-[1.8] text-ink [overflow-wrap:anywhere]">
              {question.student_answer}
            </div>
          </section>

          <section className="mt-5 border-t border-line pt-5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold tracking-[0.02em] text-ink-muted">
                参考答案
              </span>
              {question.correct_answer ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-chip px-2 py-1 text-xs text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => void copyAnswer()}
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  复制
                </button>
              ) : null}
            </div>
            {question.correct_answer ? (
              <div className="whitespace-pre-wrap rounded-chip border-l-[3px] border-brand bg-brand-soft px-4 py-3.5 text-[14px] leading-[1.8] text-ink [overflow-wrap:anywhere]">
                {question.correct_answer}
              </div>
            ) : (
              <Typography.Text type="secondary">暂无参考答案</Typography.Text>
            )}
          </section>
        </article>
      </div>
    </PageShell>
  );
}
