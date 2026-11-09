import type { ToolCallBlock } from '@agentscope-ai/agentscope/message';
import { Alert, Button, Input, Typography } from 'antd';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useChatActions } from '@/features/chat/chat-actions';
import { Markdown } from '@/features/chat/markdown';
import { parseToolInput, quizQuestionFromInput } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { submitQuizAnswer } from './submit';

const ANSWER_LIMIT = 2000;
const STALL_MS = 60_000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const CARD_CLASS = 'overflow-hidden rounded-card border border-line bg-surface';
const HEADER_CLASS = 'flex items-center gap-2 border-b border-line px-4 py-2';
const FOOTER_CLASS =
  'flex items-center justify-end gap-2 border-t border-line px-4 py-2.5 max-[767px]:flex-col-reverse';

function plainStem(stem: string): string {
  return stem
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function correctOptionOf(input: string): string | null {
  const raw = parseToolInput(input);
  const value = raw && typeof raw.correct_option === 'string' ? raw.correct_option.trim() : '';
  return value ? value.charAt(0).toUpperCase() : null;
}

function optionLabelOf(option: string, letter: string): string {
  const prefix = new RegExp(`^${letter}[.、)]\\s*`);
  return option.replace(prefix, '');
}

export interface QuizCardProps {
  replyId: string;
  toolCall: ToolCallBlock;
  submittedAnswer?: string | null;
}

export function QuizCard({ replyId, toolCall, submittedAnswer = null }: QuizCardProps) {
  const { stop, resync } = useChatActions();
  const entry = useChatStore((state) => state.hitl[toolCall.id]);
  const question = useMemo(() => quizQuestionFromInput(toolCall.input), [toolCall.input]);
  const correctOption = useMemo(() => correctOptionOf(toolCall.input), [toolCall.input]);
  const [answer, setAnswer] = useState('');
  const [stalled, setStalled] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (submittedAnswer && !answer) {
      setAnswer(submittedAnswer);
    }
  }, [submittedAnswer, answer]);

  const submittedAt = entry?.submittedAt ?? null;
  const finished = toolCall.state === 'finished';
  const submitted = Boolean(submittedAt) || finished;
  const submitting = entry?.submitting ?? false;
  const isChoice = question?.question_type === 'single_choice';
  const canSubmit = !submitted && (isChoice ? Boolean(answer) : answer.trim().length > 0);

  useEffect(() => {
    if (!submittedAt || finished) {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [submittedAt, finished]);

  const handleSubmit = async () => {
    if (!question || !canSubmit || submitting) {
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
        <span className="size-1.5 shrink-0 rounded-full bg-ink-subtle/60" aria-hidden="true" />
        <span className="shrink-0 text-[11.5px] font-medium text-ink-muted">检查题</span>
        {open ? (
          question ? (
            <span className="text-[10.5px] text-ink-subtle">{isChoice ? '单选题' : '简答题'}</span>
          ) : null
        ) : (
          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
            {question ? plainStem(question.stem) : '正在准备检查题'}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? '收起' : '展开'}
            aria-expanded={open}
            className="grid size-5 place-items-center rounded-chip text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {open ? (
        !question ? (
          <>
            <div className="px-4 py-3.5">
              <Typography.Text strong>
                {finished ? '题目数据缺失，无法作答' : '正在准备检查题…'}
              </Typography.Text>
            </div>
            {submitted ? null : (
              <div className={FOOTER_CLASS}>
                <Button size="small" onClick={stop}>
                  终止本轮
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <fieldset className="m-0 flex flex-col border-0 p-0">
              <legend className="w-full px-4 pt-3.5 pb-1 text-[14px] leading-6 font-medium text-ink">
                <Markdown content={question.stem} />
              </legend>
              {isChoice ? (
                <div className="flex flex-col" role="radiogroup" aria-label="选项">
                  {(question.options ?? []).map((option, position) => {
                    const letter = LETTERS[position] ?? String(position + 1);
                    const isCorrectOption = submitted && correctOption === letter;
                    const isSelected = answer === letter;
                    const isWrongPick =
                      submitted && Boolean(correctOption) && isSelected && !isCorrectOption;
                    const tone = isCorrectOption
                      ? 'bg-success/[0.07]'
                      : isWrongPick
                        ? 'bg-danger/[0.07]'
                        : isSelected
                          ? 'bg-surface-sunken/70'
                          : '';
                    const locked = submitted || submitting;
                    return (
                      <div
                        key={letter}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${letter} ${optionLabelOf(option, letter)}`}
                        tabIndex={locked ? -1 : 0}
                        onClick={() => {
                          if (!locked) {
                            setAnswer(letter);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (locked) {
                            return;
                          }
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setAnswer(letter);
                          }
                        }}
                        className={`flex items-start gap-3 border-t border-line px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${tone} ${locked ? '' : 'cursor-pointer hover:bg-surface-sunken/60'}`}
                      >
                        <span className="font-code text-[12px] leading-6 text-ink-subtle">
                          {letter}
                        </span>
                        <span className="min-w-0 flex-1 text-[13.5px] leading-6 text-ink">
                          {optionLabelOf(option, letter)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 pt-1 pb-3">
                  <Input.TextArea
                    variant="borderless"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="写下你的理解"
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    maxLength={ANSWER_LIMIT}
                    disabled={submitted || submitting}
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

            {stalled ? (
              <div className="px-4 pb-3">
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
              </div>
            ) : null}

            {submitted || !question ? null : (
              <div className={FOOTER_CLASS}>
                <Button type="text" onClick={stop}>
                  终止本轮
                </Button>
                <Button
                  type="primary"
                  loading={submitting}
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  提交作答
                </Button>
              </div>
            )}
          </>
        )
      ) : null}
    </section>
  );
}
