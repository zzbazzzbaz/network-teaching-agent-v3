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
import styles from './MessageItem.module.css';

function ThinkingBlock({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <details className={styles.thinking} open={streaming}>
      <summary>思考过程</summary>
      <div className={styles.thinkingBody}>{text}</div>
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
    <div className={styles.assistant}>
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
            className={styles.assistantImage}
          />
        );
      })}

      {isError ? (
        <Alert
          className={styles.error}
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
        <div className={styles.footer}>
          <Actions.Copy text={copyText} />
          {message.usage ? (
            <Typography.Text type="secondary" className={styles.usage}>
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
    <div className={styles.user}>
      {message.content.map((block) => {
        if (block.type === 'text') {
          return (
            <div key={block.id} className={`user-text ${styles.userText}`}>
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
              className={styles.userImage}
            />
          );
        }
        return null;
      })}
      {message.client_status === 'failed' ? (
        <div className={styles.failed}>
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
    <div className={styles.system}>
      <Typography.Text type="secondary">{text}</Typography.Text>
    </div>
  );
}
