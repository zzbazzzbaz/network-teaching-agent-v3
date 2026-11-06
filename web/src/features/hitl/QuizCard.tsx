import type { ToolCallBlock } from '@agentscope-ai/agentscope/message';
import { Alert, Button, Input, Radio, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { Markdown } from '@/features/chat/markdown';
import { useChatActions } from '@/features/chat/chat-actions';
import { quizQuestionFromInput } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { submitQuizAnswer } from './submit';

const ANSWER_LIMIT = 2000;
const STALL_MS = 60_000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
      <div className="mt-3 border-t border-dashed border-line py-1.5">
        <Typography.Text type="secondary">已作答</Typography.Text>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-card border border-line border-l-[3px] border-l-brand bg-surface p-4">
        <Typography.Text strong>题目数据缺失，无法作答</Typography.Text>
        <Space>
          <Button size="small" onClick={stop}>
            终止本轮
          </Button>
        </Space>
      </div>
    );
  }

  if (submittedAt) {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-card border border-line border-l-[3px] border-l-brand bg-surface p-4">
        <div className="flex items-center gap-2">
          <Typography.Text strong>检查题</Typography.Text>
          <span className="rounded-full border border-line px-2 font-code text-xs text-success">
            已提交
          </span>
        </div>
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
    <section
      className="mt-3 flex flex-col gap-3 rounded-card border border-line border-l-[3px] border-l-brand bg-surface p-4"
      aria-label="检查题"
    >
      <div className="flex items-center gap-2">
        <Typography.Text strong>检查题</Typography.Text>
        <span className="font-code text-xs text-ink-subtle">{isChoice ? '单选题' : '简答题'}</span>
      </div>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="w-full p-0 text-[15px] font-medium leading-[1.75] text-ink">
          <Markdown content={question.stem} />
        </legend>
        {isChoice ? (
          <Radio.Group
            value={answer}
            onChange={(event) => setAnswer(event.target.value as string)}
            className="block"
          >
            <Space direction="vertical" size={8}>
              {(question.options ?? []).map((option, position) => {
                const letter = LETTERS[position] ?? String(position + 1);
                return (
                  <Radio key={letter} value={letter}>
                    <span className="inline-flex items-baseline gap-2.5">
                      <span className="min-w-3.5 font-code text-ink-muted">{letter}</span>
                      <span>{option}</span>
                    </span>
                  </Radio>
                );
              })}
            </Space>
          </Radio.Group>
        ) : (
          <Input.TextArea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="写下你的理解"
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={ANSWER_LIMIT}
            showCount
          />
        )}
      </fieldset>
      {entry?.error ? <Alert type="error" showIcon message={entry.error} /> : null}
      <div className="flex justify-end gap-2 max-[767px]:flex-col-reverse">
        <Button onClick={stop}>终止本轮</Button>
        <Button type="primary" loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
          提交作答
        </Button>
      </div>
    </section>
  );
}
