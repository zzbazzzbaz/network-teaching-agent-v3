import { Bubble } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { Button } from 'antd';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import type { UIEvent } from 'react';

import type { ChatMessage } from '@/lib/agentscope/project';

import { AssistantMessage, SystemMessage, UserMessage } from './MessageItem';
import styles from './MessageList.module.css';

function stickToBottom(box: HTMLDivElement | undefined): void {
  if (box) {
    box.scrollTop = box.scrollHeight;
  }
}

const STICK_THRESHOLD = 120;
const JUMP_THRESHOLD = 200;
const LOAD_MORE_THRESHOLD = 80;

const ROLE_CONFIG = {
  user: {
    placement: 'end' as const,
    variant: 'borderless' as const,
    contentRender: (content: unknown) => <UserMessage message={content as ChatMessage} />,
  },
  assistant: {
    placement: 'start' as const,
    variant: 'borderless' as const,
    contentRender: (content: unknown) => <AssistantMessage message={content as ChatMessage} />,
  },
  system: {
    placement: 'start' as const,
    variant: 'borderless' as const,
    contentRender: (content: unknown) => <SystemMessage message={content as ChatMessage} />,
  },
};

export interface MessageListProps {
  messages: ChatMessage[];
  hasMore: boolean;
  loadingOlder: boolean;
  stickSignal: number;
  onLoadOlder: () => Promise<void>;
  ariaLive?: boolean;
}

export function MessageList({
  messages,
  hasMore,
  loadingOlder,
  stickSignal,
  onLoadOlder,
  ariaLive = true,
}: MessageListProps) {
  const listRef = useRef<ComponentRef<typeof Bubble.List>>(null);
  const stickRef = useRef(true);
  const loadingRef = useRef(false);
  const [showJump, setShowJump] = useState(false);

  const items = useMemo<BubbleItemType[]>(
    () =>
      messages.map((message) => ({
        key: message.id,
        role: message.role,
        content: message,
        streaming: message.role === 'assistant' && !message.finished_at,
      })),
    [messages],
  );

  const longList = messages.length > 40;
  const listClassNames = useMemo(
    () =>
      longList
        ? { bubble: 'content-visibility-item', scroll: styles.scroll }
        : { scroll: styles.scroll },
    [longList],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const box = listRef.current?.scrollBoxNativeElement;
    if (!box) {
      return;
    }
    box.scrollTo({ top: box.scrollHeight, behavior });
    stickRef.current = true;
    setShowJump(false);
  }, []);

  useLayoutEffect(() => {
    if (!stickRef.current) {
      return;
    }
    stickToBottom(listRef.current?.scrollBoxNativeElement);
  });

  useEffect(() => {
    if (!stickRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      stickToBottom(listRef.current?.scrollBoxNativeElement);
    });
    return () => cancelAnimationFrame(frame);
  });

  useEffect(() => {
    if (stickSignal === 0) {
      return;
    }
    stickRef.current = true;
    setShowJump(false);
    const frame = requestAnimationFrame(() => {
      stickToBottom(listRef.current?.scrollBoxNativeElement);
    });
    return () => cancelAnimationFrame(frame);
  }, [stickSignal]);

  const handleLoadOlder = useCallback(async () => {
    const box = listRef.current?.scrollBoxNativeElement;
    if (!box || loadingRef.current || !hasMore) {
      return;
    }
    loadingRef.current = true;
    const previousHeight = box.scrollHeight;
    try {
      await onLoadOlder();
    } finally {
      loadingRef.current = false;
      requestAnimationFrame(() => {
        const next = listRef.current?.scrollBoxNativeElement;
        if (!next) {
          return;
        }
        next.scrollTop += next.scrollHeight - previousHeight;
      });
    }
  }, [hasMore, onLoadOlder]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const box = event.currentTarget;
      const distance = box.scrollHeight - box.scrollTop - box.clientHeight;
      stickRef.current = distance < STICK_THRESHOLD;
      setShowJump(distance > JUMP_THRESHOLD);
      if (box.scrollTop < LOAD_MORE_THRESHOLD && hasMore && !loadingRef.current) {
        void handleLoadOlder();
      }
    },
    [handleLoadOlder, hasMore],
  );

  return (
    <div className={styles.root}>
      {loadingOlder ? <div className={styles.olderHint}>正在加载更早的消息</div> : null}
      <Bubble.List
        ref={listRef}
        className={styles.list}
        classNames={listClassNames}
        items={items}
        role={ROLE_CONFIG}
        autoScroll={false}
        onScroll={handleScroll}
        aria-live={ariaLive ? 'polite' : undefined}
      />
      {showJump ? (
        <Button
          className={styles.jump}
          size="small"
          shape="round"
          onClick={() => scrollToBottom('smooth')}
        >
          回到底部
        </Button>
      ) : null}
    </div>
  );
}
