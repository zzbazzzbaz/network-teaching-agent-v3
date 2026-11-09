import type { AgentEvent } from '@agentscope-ai/agentscope/event';
import { App } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { toErrorMessage } from '@/api/client';
import { listMessages, sendMessage } from '@/api/messages';
import { getSessionStatus, stopSession } from '@/api/sessions';
import type { ApiError } from '@/api/client';
import { recordMetric } from '@/lib/metrics';
import { phaseFromStatus, type ChatMessage } from '@/lib/agentscope/project';
import { queryClient } from '@/lib/query-client';
import { StreamController, type ConnectionPhase } from '@/lib/sse/stream-controller';
import { useChatStore, createOptimisticUserMessage } from '@/stores/chat-store';

export interface UseChatSessionResult {
  messages: ChatMessage[];
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
  loadError: string | null;
  connection: ConnectionPhase;
  send: (text: string, fileIds: string[], previewUrls?: string[]) => Promise<boolean>;
  stop: () => Promise<void>;
  retry: () => Promise<void>;
  resend: (messageId: string, text: string) => Promise<void>;
  resync: () => Promise<string | null>;
  loadOlder: () => Promise<void>;
  reconnect: () => void;
}

const PAGE_SIZE = 50;

export function useChatSession(sessionId: string | null, userName: string): UseChatSessionResult {
  const { message } = App.useApp();
  const runtime = useChatStore((state) => state.runtime);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionPhase>('closed');
  const controllerRef = useRef<StreamController | null>(null);
  const lastUserTextRef = useRef<string>('');
  const sessionRef = useRef<string | null>(sessionId);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  const resync = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current) {
      return null;
    }
    const [history, status] = await Promise.all([
      listMessages(current, { limit: PAGE_SIZE }),
      getSessionStatus(current),
    ]);
    const store = useChatStore.getState();
    store.mergeAuthoritative({
      messages: history.messages,
      eventCursor: history.event_cursor,
      hasMore: history.has_more,
    });
    store.setPhase(phaseFromStatus(status.status));
    return history.event_cursor;
  }, []);

  useEffect(() => {
    if (!sessionId) {
      useChatStore.getState().reset();
      setLoading(false);
      setLoadError(null);
      setConnection('closed');
      return;
    }

    let cancelled = false;
    const store = useChatStore.getState();
    store.reset();
    setLoading(true);
    setLoadError(null);

    const bootstrap = async () => {
      try {
        const [history, status] = await Promise.all([
          listMessages(sessionId, { limit: PAGE_SIZE }),
          getSessionStatus(sessionId),
        ]);
        if (cancelled) {
          return;
        }
        store.initSession({
          sessionId,
          messages: history.messages,
          eventCursor: history.event_cursor,
          hasMore: history.has_more,
          phase: phaseFromStatus(status.status),
        });
        setLoading(false);

        const controller = new StreamController({
          sessionId,
          onEvent: (event: AgentEvent) => {
            if (event.type === 'CUSTOM' && event.name === 'session_updated') {
              void queryClient.invalidateQueries({ queryKey: ['sessions'] });
            }
            useChatStore.getState().queueEvents([event]);
          },
          onPhaseChange: (phase, state) => {
            setConnection(phase);
            const current = useChatStore.getState();
            if (phase === 'reconnecting') {
              current.setPhase('reconnecting');
            } else if (phase === 'error') {
              recordMetric('sse_error_total', 1, { attempt: state.attempt });
              current.setPhase('error', '连接已断开，点击重连');
            }
          },
          resync,
        });
        controllerRef.current = controller;
        controller.start(history.event_cursor);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadError(toErrorMessage(error, '对话加载失败'));
        setLoading(false);
      }
    };

    void bootstrap();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && controllerRef.current) {
        const phase = useChatStore.getState().runtime?.phase;
        if (phase === 'error') {
          void resync()
            .then(() => controllerRef.current?.reconnectNow())
            .catch(() => undefined);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, [sessionId, resync]);

  const send = useCallback(
    async (text: string, fileIds: string[], previewUrls: string[] = []) => {
      const current = sessionRef.current;
      const state = useChatStore.getState();
      const active = state.runtime;
      if (!current || !active) {
        return false;
      }
      if (active.phase === 'reconnecting') {
        message.warning('正在恢复连接，请稍后再试');
        return false;
      }
      const trimmed = text.trim();
      if (!trimmed && fileIds.length === 0) {
        return false;
      }

      const optimistic = createOptimisticUserMessage(trimmed, {
        name: userName,
        images: previewUrls,
      });
      state.addOptimisticMessage(optimistic);
      lastUserTextRef.current = trimmed;

      try {
        await sendMessage(current, {
          text: trimmed,
          attachments: fileIds.map((fileId) => ({ file_id: fileId })),
        });
        useChatStore.getState().setPhase('running');
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
        return true;
      } catch (error) {
        const failure = error as ApiError;
        useChatStore.getState().markMessageFailed(optimistic.id);
        if (failure.status === 409) {
          message.warning('上一条还在生成，请稍候');
        } else if (failure.status === 400) {
          message.error(toErrorMessage(error, '消息无法发送'));
        } else if (failure.status === 503) {
          message.error('对话服务暂不可用，请稍后重试');
        } else {
          message.error(toErrorMessage(error, '发送失败，请重试'));
        }
        return false;
      }
    },
    [message, userName],
  );

  const stop = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    try {
      await stopSession(current);
      message.info('已停止生成');
    } catch (error) {
      message.error(toErrorMessage(error, '终止失败，请重试'));
    }
  }, [message]);

  const retry = useCallback(async () => {
    const text = lastUserTextRef.current;
    if (!text) {
      message.info('没有可重试的内容');
      return;
    }
    await send(text, []);
  }, [message, send]);

  const resend = useCallback(
    async (messageId: string, text: string) => {
      useChatStore.getState().removeMessage(messageId);
      await send(text, []);
    },
    [send],
  );

  const loadOlder = useCallback(async () => {
    const current = sessionRef.current;
    const active = useChatStore.getState().runtime;
    if (!current || !active || !active.hasMore || loadingOlder) {
      return;
    }
    const oldest = active.messages.find((item) => !item.client_status);
    if (!oldest) {
      return;
    }
    setLoadingOlder(true);
    try {
      const page = await listMessages(current, { before: oldest.id, limit: PAGE_SIZE });
      useChatStore.getState().prependMessages(page.messages, page.has_more);
    } catch (error) {
      message.error(toErrorMessage(error, '更早的消息加载失败'));
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, message]);

  const reconnect = useCallback(() => {
    void resync()
      .then(() => controllerRef.current?.reconnectNow())
      .catch(() => message.error('重连失败，请刷新页面'));
  }, [message, resync]);

  return {
    messages: runtime?.messages ?? [],
    hasMore: runtime?.hasMore ?? false,
    loading,
    loadingOlder,
    loadError,
    connection,
    send,
    stop,
    retry,
    resend,
    resync,
    loadOlder,
    reconnect,
  };
}
