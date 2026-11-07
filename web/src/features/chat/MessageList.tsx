import { Button } from 'antd';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { UIEvent } from 'react';

import type { ChatMessage } from '@/lib/agentscope/project';

import { AssistantMessage, SystemMessage, UserMessage } from './MessageItem';

const STICK_THRESHOLD = 120;
const JUMP_THRESHOLD = 200;
const LOAD_MORE_THRESHOLD = 80;

function stickToBottom(box: HTMLDivElement | null): void {
  if (box) {
    box.scrollTop = box.scrollHeight;
  }
}

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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const loadingRef = useRef(false);
  const [showJump, setShowJump] = useState(false);

  const longList = messages.length > 40;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const box = boxRef.current;
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
    stickToBottom(boxRef.current);
  });

  useEffect(() => {
    if (!stickRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      stickToBottom(boxRef.current);
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
      stickToBottom(boxRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [stickSignal]);

  const handleLoadOlder = useCallback(async () => {
    const box = boxRef.current;
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
        const next = boxRef.current;
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={boxRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
        aria-live={ariaLive ? 'polite' : undefined}
      >
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 py-5 lg:px-8 lg:py-6">
          {loadingOlder ? (
            <div className="py-1 text-center text-[11px] text-ink-subtle">正在加载更早的消息</div>
          ) : null}
          {messages.map((message, index) => {
            const last = index === messages.length - 1;
            return (
              <div
                key={message.id}
                className={
                  longList
                    ? '[content-visibility:auto] [contain-intrinsic-size:auto_120px]'
                    : undefined
                }
              >
                {message.role === 'assistant' ? (
                  <AssistantMessage message={message} last={last} />
                ) : message.role === 'user' ? (
                  <UserMessage message={message} />
                ) : (
                  <SystemMessage message={message} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showJump ? (
        <Button
          className="absolute bottom-4 left-1/2 z-5 -translate-x-1/2 shadow-[0_2px_8px_rgb(16_23_32/12%)] max-[767px]:bottom-3"
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
