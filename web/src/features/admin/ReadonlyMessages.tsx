import type { DataBlock, Msg, ToolCallBlock } from '@agentscope-ai/agentscope/message';
import { Image, Typography } from 'antd';
import { useMemo } from 'react';

import { Markdown } from '@/features/chat/markdown';
import { buildSegments, messagePlainText } from '@/features/chat/segments';
import { ToolChain } from '@/features/chat/ToolChain';
import { quizQuestionFromInput } from '@/lib/agentscope/project';
import { quizSubmittedAnswer } from '@/lib/agentscope/render-policy';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function ReadonlyQuizCard({
  call,
  submittedAnswer,
}: {
  call: ToolCallBlock;
  submittedAnswer: string | null;
}) {
  const question = quizQuestionFromInput(call.input);
  if (!question) {
    return null;
  }
  const isChoice = question.question_type === 'single_choice';
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2">
        <span className="size-1.5 shrink-0 rounded-full bg-ink-subtle/60" aria-hidden="true" />
        <span className="text-[11.5px] font-medium text-ink-muted">检查题</span>
        <span className="text-[10.5px] text-ink-subtle">{isChoice ? '单选题' : '简答题'}</span>
      </header>
      <div className="px-4 py-3.5">
        <Markdown content={question.stem} />
        {isChoice && question.options ? (
          <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
            {question.options.map((option, position) => {
              const letter = LETTERS[position] ?? String(position + 1);
              const selected = submittedAnswer === letter;
              return (
                <li
                  key={letter}
                  className={`flex items-start gap-3 rounded-chip px-2 py-1.5 text-[13.5px] leading-6 ${
                    selected ? 'bg-brand-soft text-ink' : 'text-ink'
                  }`}
                >
                  <span className="font-code text-[12px] leading-6 text-ink-subtle">{letter}</span>
                  <span className="min-w-0 flex-1">{option}</span>
                  {selected ? <span className="text-[11px] text-brand">已选</span> : null}
                </li>
              );
            })}
          </ol>
        ) : null}
        {submittedAnswer ? (
          <div className="mt-3 rounded-chip border-l-[3px] border-brand bg-brand-soft px-3 py-2 text-[13px] leading-6">
            学生答案：{submittedAnswer}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReadonlyAssistantMessage({ message }: { message: Msg }) {
  const { segments } = useMemo(() => buildSegments(message), [message]);
  const quizAnswers = useMemo(() => {
    const answers = new Map<string, string>();
    for (const block of message.content) {
      if (block.type !== 'tool_result') {
        continue;
      }
      const answer = quizSubmittedAnswer(block);
      if (answer) {
        answers.set(block.id, answer);
      }
    }
    return answers;
  }, [message]);

  return (
    <div className="relative min-w-0 pl-7 lg:pl-8">
      <span
        aria-hidden="true"
        className="absolute top-2 left-0 size-[7px] rounded-full bg-brand ring-2 ring-surface"
      />
      <div className="flex min-w-0 flex-col gap-3">
        {segments.map((segment) => {
          if (segment.kind === 'text') {
            return <Markdown key={segment.key} content={segment.text} />;
          }
          if (segment.kind === 'thinking') {
            return (
              <details
                key={segment.key}
                className="rounded-card border border-line bg-surface-sunken/60 px-3 py-2 text-[12.5px] leading-6 text-ink-muted"
              >
                <summary className="cursor-pointer select-none text-[12px] text-ink-subtle">
                  思考过程
                </summary>
                <div className="mt-2 whitespace-pre-wrap leading-[1.75]">{segment.text}</div>
              </details>
            );
          }
          if (segment.kind === 'tools') {
            return (
              <ToolChain key={segment.key} calls={segment.calls} results={segment.results} />
            );
          }
          if (segment.kind === 'quiz') {
            return (
              <ReadonlyQuizCard
                key={segment.key}
                call={segment.call}
                submittedAnswer={quizAnswers.get(segment.call.id) ?? null}
              />
            );
          }
          return (
            <Image
              key={segment.key}
              src={segment.src}
              alt={segment.alt}
              referrerPolicy="no-referrer"
              style={{ maxWidth: 320 }}
              className="rounded-card border border-line"
            />
          );
        })}
      </div>
    </div>
  );
}

function ReadonlyUserMessage({ message }: { message: Msg }) {
  return (
    <div className="flex flex-col items-end gap-2">
      {message.content.map((block) => {
        if (block.type === 'text') {
          return (
            <div
              key={block.id}
              className="ml-auto w-fit max-w-[86%] rounded-card border border-line bg-surface-sunken px-3.5 py-2.5 text-[14px] leading-7 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]"
            >
              {block.text}
            </div>
          );
        }
        if (block.type === 'data') {
          const data = block as DataBlock;
          const src =
            data.source.type === 'url'
              ? data.source.url
              : `data:${data.source.media_type};base64,${data.source.data}`;
          return (
            <Image
              key={data.id}
              src={src}
              alt={data.name ?? '图片'}
              referrerPolicy="no-referrer"
              style={{ maxWidth: 320 }}
              className="rounded-card border border-line"
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export function ReadonlyMessages({ messages }: { messages: Msg[] }) {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) => {
        if (message.role === 'user') {
          return <ReadonlyUserMessage key={message.id} message={message} />;
        }
        if (message.role === 'assistant') {
          return <ReadonlyAssistantMessage key={message.id} message={message} />;
        }
        const text = messagePlainText(message);
        return (
          <div key={message.id} className="border-l-2 border-line py-1 pl-3">
            <Typography.Text type="secondary" className="text-[12.5px]">
              {text}
            </Typography.Text>
          </div>
        );
      })}
    </div>
  );
}
