import type { ToolCallBlock } from '@agentscope-ai/agentscope/message';
import { Alert, Button, Input, Radio, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { useChatActions } from '@/features/chat/chat-actions';
import { Markdown } from '@/features/chat/markdown';
import { quizQuestionFromInput } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { submitQuizAnswer } from './submit';

const ANSWER_LIMIT = 2000;
const STALL_MS = 60_000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const CARD_CLASS = 'overflow-hidden rounded-card border border-warning/35 bg-warning/[0.04]';
const HEADER_CLASS = 'flex items-center gap-2 border-b border-warning/25 px-4 py-2';
const FOOTER_CLASS =
  'flex items-center justify-end gap-2 border-t border-warning/25 px-4 py-2.5 max-[767px]:flex-col-reverse';

export interface QuizCardProps {
  replyId: string;
  toolCall: ToolCallBlock;
}

export function QuizCard({ replyId, toolCall }: QuizCardProps) {
  const { stop, resync } = useChatActions();
  const entry = useChatStore((state) => state.hitl[toolCall.id]);
  const question = useMemo(() => quizQuestionFromInput(toolCall.input), [toolCall.input]);
  const [answer, setAnswer] = useState('');
  const [stalled, setStalled] = useState(false);

  const submittedAt = entry?.submittedAt ?? null;

  useEffect(() => {
    if (!submittedAt || toolCall.state === 'finished') {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [submittedAt, toolCall.state]);

  if (toolCall.state === 'finished') {
    return (
      <div className="border-t border-dashed border-line py-1.5 text-[11.5px] text-ink-subtle">
        已作答
      </div>
    );
  }

  if (!question) {
    return (
      <section className={CARD_CLASS} aria-label="检查题">
        <div className={HEADER_CLASS}>
          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          <span className="text-[11px] font-medium text-warning">作答检查点</span>
        </div>
        <div className="px-4 py-3.5">
          <Typography.Text strong>题目数据缺失，无法作答</Typography.Text>
        </div>
        <div className={FOOTER_CLASS}>
          <Button size="small" onClick={stop}>
            终止本轮
          </Button>
        </div>
      </section>
    );
  }

  if (submittedAt) {
    return (
      <section className={CARD_CLASS} aria-label="检查题">
        <div className={HEADER_CLASS}>
          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          <span className="text-[11px] font-medium text-warning">作答检查点</span>
          <span className="ml-auto rounded-full border border-success/30 bg-success/5 px-2 font-code text-[10.5px] text-success">
            已提交
          </span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <Typography.Text type="secondary">已提交，等待反馈</Typography.Text>
          {stalled ? (
            <Alert
              type="warning"
              showIcon
              message="暂未收到反馈"
              description="可以重新同步一次会话状态，或继续等待。"
              action={
                <Button size="small" onClick={() => void resync()}>
                  重新同步
                </Button>
              }
            />
          ) : null}
        </div>
      </section>
    );
  }

  const isChoice = question.question_type === 'single_choice';
  const submitting = entry?.submitting ?? false;
  const canSubmit = isChoice ? Boolean(answer) : answer.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      return;
    }
    try {
      await submitQuizAnswer({
        replyId,
        toolCallId: toolCall.id,
        rawInput: toolCall.input,
        answer: isChoice ? answer : answer.trim(),
      });
    } catch {
      return;
    }
  };

  return (
    <section className={CARD_CLASS} aria-label="检查题">
      <div className={HEADER_CLASS}>
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        <span className="text-[11px] font-medium text-warning">作答检查点</span>
        <span className="ml-auto text-[10.5px] text-ink-subtle">
          {isChoice ? '单选题' : '简答题'}
        </span>
      </div>
      <fieldset className="m-0 flex flex-col border-0 p-0">
        <legend className="w-full px-4 pt-3.5 pb-1 text-[14px] leading-6 font-medium text-ink">
          <Markdown content={question.stem} />
        </legend>
        {isChoice ? (
          <Radio.Group
            value={answer}
            onChange={(event) => setAnswer(event.target.value as string)}
            className="flex flex-col"
          >
            {(question.options ?? []).map((option, position) => {
              const letter = LETTERS[position] ?? String(position + 1);
              return (
                <label
                  key={letter}
                  className="flex cursor-pointer items-start gap-3 border-t border-warning/20 px-4 py-2.5 transition-colors hover:bg-warning/5"
                >
                  <Radio value={letter} className="mt-0.5" />
                  <span className="min-w-0 text-[13.5px] leading-6 text-ink">
                    <span className="mr-1.5 font-code text-ink-subtle">{letter}</span>
                    {option}
                  </span>
                </label>
              );
            })}
          </Radio.Group>
        ) : (
          <div className="px-4 pt-1 pb-3">
            <Input.TextArea
              variant="borderless"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="写下你的理解"
              autoSize={{ minRows: 3, maxRows: 8 }}
              maxLength={ANSWER_LIMIT}
              className="rounded-chip border border-line-strong bg-surface px-3 py-2 focus:outline-none"
            />
          </div>
        )}
      </fieldset>
      {entry?.error ? (
        <div className="px-4 pb-3">
          <Alert type="error" showIcon message={entry.error} />
        </div>
      ) : null}
      <div className={FOOTER_CLASS}>
        <Button type="text" onClick={stop}>
          终止本轮
        </Button>
        <Button type="primary" loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
          提交作答
        </Button>
      </div>
    </section>
  );
}
