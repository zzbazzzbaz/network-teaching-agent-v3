import { Actions } from '@ant-design/x';
import { Alert, Button, Image, Typography } from 'antd';
import { useMemo } from 'react';

import { ConfirmCard } from '@/features/hitl/ConfirmCard';
import { QuizCard } from '@/features/hitl/QuizCard';
import { ToolChain } from '@/features/chat/ToolChain';
import { useChatActions } from '@/features/chat/chat-actions';
import type { ChatMessage } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { Markdown } from './markdown';
import { buildSegments, messagePlainText } from './segments';

function ThinkingBlock({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <details
      className="my-2 rounded-card bg-surface-sunken px-3 py-2 text-[13px] text-ink-muted"
      open={streaming}
    >
      <summary className="cursor-pointer select-none">思考过程</summary>
      <div className="mt-2 whitespace-pre-wrap leading-[1.7]">{text}</div>
    </details>
  );
}

export function AssistantMessage({ message }: { message: ChatMessage }) {
  const { retry } = useChatActions();
  const { segments, quizCalls } = useMemo(() => buildSegments(message), [message]);
  const pendingConfirm = useChatStore((state) => state.runtime?.pendingConfirm ?? null);
  const streaming = !message.finished_at;
  const copyText = messagePlainText(message);
  const isError = message.finished_reason === 'error';

  return (
    <div className="w-full text-ink">
      {segments.map((segment) => {
        if (segment.kind === 'text') {
          return (
            <Markdown
              key={segment.key}
              content={segment.text}
              streaming={segment.streaming && streaming}
            />
          );
        }
        if (segment.kind === 'thinking') {
          return (
            <ThinkingBlock
              key={segment.key}
              text={segment.text}
              streaming={segment.streaming && streaming}
            />
          );
        }
        if (segment.kind === 'tools') {
          return <ToolChain key={segment.key} calls={segment.calls} results={segment.results} />;
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

      {isError ? (
        <Alert
          className="mt-3"
          type="error"
          showIcon
          message="本轮生成失败"
          description={message.error?.message ?? '生成过程中出现错误，可以重试一次。'}
          action={
            <Button size="small" onClick={retry}>
              重试
            </Button>
          }
        />
      ) : null}

      {quizCalls.map((call) => (
        <QuizCard key={call.id} replyId={message.id} toolCall={call} />
      ))}

      {pendingConfirm && pendingConfirm.replyId === message.id ? (
        <ConfirmCard pending={pendingConfirm} />
      ) : null}

      {!streaming && copyText ? (
        <div className="mt-2 flex min-h-7 items-center gap-3">
          <Actions.Copy text={copyText} />
          {message.usage ? (
            <Typography.Text type="secondary" className="font-code text-xs">
              {message.usage.input_tokens} / {message.usage.output_tokens} tokens
            </Typography.Text>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function UserMessage({ message }: { message: ChatMessage }) {
  const { resend } = useChatActions();
  return (
    <div className="flex flex-col items-end gap-2">
      {message.content.map((block) => {
        if (block.type === 'text') {
          return (
            <div
              key={block.id}
              className="max-w-[min(86vw,640px)] whitespace-pre-wrap rounded-[14px_14px_4px_14px] bg-brand-soft px-3.5 py-2.5 text-[15px] leading-[1.7] [overflow-wrap:anywhere]"
            >
              {block.text}
            </div>
          );
        }
        if (block.type === 'data') {
          const src =
            block.source.type === 'url'
              ? block.source.url
              : `data:${block.source.media_type};base64,${block.source.data}`;
          return (
            <Image
              key={block.id}
              src={src}
              alt={block.name ?? '图片'}
              referrerPolicy="no-referrer"
              style={{ maxWidth: 320 }}
              className="rounded-card border border-line"
            />
          );
        }
        return null;
      })}
      {message.client_status === 'failed' ? (
        <div className="flex items-center gap-1 text-xs">
          <Typography.Text type="danger">发送失败</Typography.Text>
          <Button
            type="link"
            size="small"
            onClick={() => resend(message.id, messagePlainText(message))}
          >
            重试
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SystemMessage({ message }: { message: ChatMessage }) {
  const text = messagePlainText(message);
  return (
    <div className="w-full border-l-2 border-line py-1 pl-3 text-[13px]">
      <Typography.Text type="secondary">{text}</Typography.Text>
    </div>
  );
}
