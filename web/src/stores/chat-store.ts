import type { AgentEvent } from '@agentscope-ai/agentscope/event';
import type { Msg } from '@agentscope-ai/agentscope/message';
import { create } from 'zustand';

import { timeNear } from '@/lib/format';
import {
  applyEvents,
  cloneMessage,
  collectPendingConfirm,
  collectPendingHitl,
  createRuntime,
  createUserMessage,
  messageText,
  type ChatMessage,
  type ChatRuntime,
  type SessionPhase,
} from '@/lib/agentscope/project';

const OPTIMISTIC_MATCH_WINDOW_MS = 10_000;

export interface HitlEntry {
  submitting: boolean;
  submittedAt: number | null;
  error: string | null;
}

interface ChatState {
  runtime: ChatRuntime | null;
  hitl: Record<string, HitlEntry>;
  initSession: (payload: {
    sessionId: string;
    messages: Msg[];
    eventCursor: string | null;
    hasMore: boolean;
    phase: SessionPhase;
  }) => void;
  reset: () => void;
  prependMessages: (messages: Msg[], hasMore: boolean) => void;
  mergeAuthoritative: (payload: {
    messages: Msg[];
    eventCursor: string | null;
    hasMore: boolean;
  }) => void;
  setPhase: (phase: SessionPhase, error?: string | null) => void;
  setCursor: (cursor: string | null) => void;
  queueEvents: (events: AgentEvent[]) => void;
  addOptimisticMessage: (message: ChatMessage) => void;
  markMessageFailed: (messageId: string) => void;
  removeMessage: (messageId: string) => void;
  beginHitlSubmit: (toolCallId: string) => void;
  finishHitlSubmit: (toolCallId: string, error?: string) => void;
  failHitlSubmit: (toolCallId: string, error: string) => void;
  clearHitl: (toolCallId: string) => void;
}

function reindex(messages: ChatMessage[]): Record<string, number> {
  const index: Record<string, number> = {};
  messages.forEach((message, position) => {
    index[message.id] = position;
  });
  return index;
}

function isOptimistic(message: ChatMessage): boolean {
  return message.client_status === 'sending' || message.client_status === 'failed';
}

function matchesServerMessage(optimistic: ChatMessage, server: Msg): boolean {
  if (server.role !== 'user' || optimistic.role !== 'user') {
    return false;
  }
  if (messageText(server).trim() !== messageText(optimistic).trim()) {
    return false;
  }
  const reference = optimistic.client_created_at ?? optimistic.created_at;
  return timeNear(server.created_at, reference, OPTIMISTIC_MATCH_WINDOW_MS);
}

export function reconcileMessages(local: ChatMessage[], server: Msg[]): ChatMessage[] {
  const optimistic = local.filter(isOptimistic);
  const keptOptimistic = optimistic.filter(
    (candidate) => !server.some((message) => matchesServerMessage(candidate, message)),
  );
  const serverMessages = server.map((message) => cloneMessage(message as ChatMessage));
  const merged = [...serverMessages, ...keptOptimistic];
  return merged.sort((left, right) => {
    const leftAt = new Date(left.created_at).getTime();
    const rightAt = new Date(right.created_at).getTime();
    return leftAt - rightAt;
  });
}

let pendingEvents: AgentEvent[] = [];
let flushHandle: number | null = null;

function cancelPendingFlush(): void {
  pendingEvents = [];
  if (flushHandle !== null) {
    cancelAnimationFrame(flushHandle);
    flushHandle = null;
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  runtime: null,
  hitl: {},

  initSession({ sessionId, messages, eventCursor, hasMore, phase }) {
    cancelPendingFlush();
    const runtime = createRuntime(sessionId);
    const cloned = messages.map((message) => cloneMessage(message as ChatMessage));
    runtime.messages = cloned;
    runtime.index = reindex(cloned);
    runtime.eventCursor = eventCursor;
    runtime.hasMore = hasMore;
    const pendingHitl = collectPendingHitl(cloned);
    runtime.pendingHitl = pendingHitl[0] ?? null;
    runtime.pendingConfirm = collectPendingConfirm(cloned);
    runtime.phase = phase;
    set({ runtime, hitl: {} });
  },

  reset() {
    cancelPendingFlush();
    set({ runtime: null, hitl: {} });
  },

  prependMessages(messages, hasMore) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    const older = messages.map((message) => cloneMessage(message as ChatMessage));
    const existingIds = new Set(runtime.messages.map((message) => message.id));
    const deduped = older.filter((message) => !existingIds.has(message.id));
    const merged = [...deduped, ...runtime.messages];
    set({
      runtime: {
        ...runtime,
        messages: merged,
        index: reindex(merged),
        hasMore,
      },
    });
  },

  mergeAuthoritative({ messages, eventCursor, hasMore }) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    const merged = reconcileMessages(runtime.messages, messages);
    const pendingHitl = collectPendingHitl(merged);
    set({
      runtime: {
        ...runtime,
        messages: merged,
        index: reindex(merged),
        eventCursor: eventCursor ?? runtime.eventCursor,
        hasMore,
        pendingHitl: pendingHitl[0] ?? null,
        pendingConfirm: collectPendingConfirm(merged),
      },
    });
  },

  setPhase(phase, error = null) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    set({ runtime: { ...runtime, phase, error } });
  },

  setCursor(cursor) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    set({ runtime: { ...runtime, eventCursor: cursor } });
  },

  queueEvents(events) {
    if (events.length === 0) {
      return;
    }
    pendingEvents = pendingEvents.concat(events);
    if (flushHandle !== null) {
      return;
    }
    flushHandle = requestAnimationFrame(() => {
      flushHandle = null;
      const batch = pendingEvents;
      pendingEvents = [];
      const runtime = get().runtime;
      if (!runtime || batch.length === 0) {
        return;
      }
      set({ runtime: applyEvents(runtime, batch) });
    });
  },

  addOptimisticMessage(message) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    const messages = [...runtime.messages, message];
    set({
      runtime: {
        ...runtime,
        messages,
        index: reindex(messages),
      },
    });
  },

  markMessageFailed(messageId) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    const messages = runtime.messages.map((message) =>
      message.id === messageId ? { ...message, client_status: 'failed' as const } : message,
    );
    set({ runtime: { ...runtime, messages, index: reindex(messages) } });
  },

  removeMessage(messageId) {
    const runtime = get().runtime;
    if (!runtime) {
      return;
    }
    const messages = runtime.messages.filter((message) => message.id !== messageId);
    set({ runtime: { ...runtime, messages, index: reindex(messages) } });
  },

  beginHitlSubmit(toolCallId) {
    const entry = get().hitl[toolCallId];
    if (entry?.submitting) {
      return;
    }
    set({
      hitl: {
        ...get().hitl,
        [toolCallId]: { submitting: true, submittedAt: entry?.submittedAt ?? null, error: null },
      },
    });
  },

  finishHitlSubmit(toolCallId, error) {
    const entry = get().hitl[toolCallId];
    set({
      hitl: {
        ...get().hitl,
        [toolCallId]: {
          submitting: false,
          submittedAt: entry?.submittedAt ?? Date.now(),
          error: error ?? null,
        },
      },
    });
  },

  failHitlSubmit(toolCallId, error) {
    const entry = get().hitl[toolCallId];
    set({
      hitl: {
        ...get().hitl,
        [toolCallId]: {
          submitting: false,
          submittedAt: entry?.submittedAt ?? null,
          error,
        },
      },
    });
  },

  clearHitl(toolCallId) {
    const next = { ...get().hitl };
    delete next[toolCallId];
    set({ hitl: next });
  },
}));

export function createOptimisticUserMessage(
  text: string,
  options: { name: string; images?: string[] },
): ChatMessage {
  const createdAt = new Date().toISOString();
  const id = `local-${randomId()}`;
  return createUserMessage(text, {
    id,
    name: options.name,
    createdAt,
    images: options.images,
  });
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
