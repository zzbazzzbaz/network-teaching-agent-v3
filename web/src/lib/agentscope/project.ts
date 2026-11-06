import type { AgentEvent } from '@agentscope-ai/agentscope/event';
import {
  appendEvent,
  createMsg,
  type ContentBlock,
  type DataBlock,
  type Msg,
  type TextBlock,
  type ToolCallBlock,
} from '@agentscope-ai/agentscope/message';

import type { QuestionType } from '@/api/types';
import { truncate } from '@/lib/format';

export type SessionPhase =
  | 'idle'
  | 'running'
  | 'awaiting_external_result'
  | 'awaiting_permission'
  | 'reconnecting'
  | 'error';

export interface QuizQuestion {
  question_type: QuestionType;
  stem: string;
  options: string[] | null;
}

export interface PendingHitl {
  replyId: string;
  toolCallId: string;
  kind: 'quiz';
  question: QuizQuestion;
  submittedAt: string | null;
}

export interface PendingConfirmTool {
  id: string;
  name: string;
  input: string;
}

export interface PendingConfirm {
  replyId: string;
  toolCalls: PendingConfirmTool[];
  submittedAt: string | null;
}

export interface ChatMessage extends Msg {
  client_status?: 'sending' | 'failed';
  client_created_at?: string;
}

export interface ChatRuntime {
  sessionId: string;
  messages: ChatMessage[];
  index: Record<string, number>;
  eventCursor: string | null;
  hasMore: boolean;
  phase: SessionPhase;
  pendingHitl: PendingHitl | null;
  pendingConfirm: PendingConfirm | null;
  error: string | null;
  seenEventIds: Set<string>;
  seenOrder: string[];
}

const SEEN_LIMIT = 1000;

export const QUIZ_TOOL_NAME = 'quiz_student';
const MAX_SYSTEM_NOTE_CHARS = 400;

export function createRuntime(sessionId: string): ChatRuntime {
  return {
    sessionId,
    messages: [],
    index: {},
    eventCursor: null,
    hasMore: false,
    phase: 'idle',
    pendingHitl: null,
    pendingConfirm: null,
    error: null,
    seenEventIds: new Set<string>(),
    seenOrder: [],
  };
}

function cloneBlock(block: ContentBlock): ContentBlock {
  if (block.type === 'data') {
    return { ...block, source: { ...block.source } };
  }
  if (block.type === 'tool_result') {
    return {
      ...block,
      output: Array.isArray(block.output)
        ? block.output.map((item) => ({ ...item }))
        : block.output,
      metadata: block.metadata ? { ...block.metadata } : block.metadata,
    };
  }
  return { ...block };
}

export function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    content: message.content.map(cloneBlock),
    metadata: { ...message.metadata },
  };
}

export function createAssistantMessage(id: string, name: string, createdAt?: string): ChatMessage {
  return createMsg({
    id,
    name: name || 'assistant',
    role: 'assistant',
    content: [],
    created_at: createdAt,
  });
}

export function createUserMessage(
  text: string,
  options: { id: string; name: string; createdAt: string; images?: string[] },
): ChatMessage {
  const content: ContentBlock[] = [];
  if (text.trim()) {
    content.push({
      type: 'text',
      text: text.trim(),
      id: `${options.id}-text`,
      created_at: options.createdAt,
    });
  }
  (options.images ?? []).forEach((url, position) => {
    content.push({
      type: 'data',
      id: `${options.id}-image-${position}`,
      source: { type: 'url', url, media_type: 'image/*' },
      created_at: options.createdAt,
    });
  });
  return {
    ...createMsg({
      id: options.id,
      name: options.name,
      role: 'user',
      content,
      created_at: options.createdAt,
    }),
    client_status: 'sending',
    client_created_at: options.createdAt,
  };
}

export function messageText(message: Msg): string {
  return message.content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

const parseCache = new Map<string, Record<string, unknown> | null>();

export function parseToolInput(input: string): Record<string, unknown> | null {
  if (!input) {
    return null;
  }
  if (parseCache.has(input)) {
    return parseCache.get(input) ?? null;
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    const value: unknown = JSON.parse(input);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }
  if (parseCache.size > 400) {
    parseCache.clear();
  }
  parseCache.set(input, parsed);
  return parsed;
}

export function quizQuestionFromInput(input: string): QuizQuestion | null {
  const raw = parseToolInput(input);
  if (!raw) {
    return null;
  }
  const questionType = raw.question_type;
  if (questionType !== 'single_choice' && questionType !== 'short_answer') {
    return null;
  }
  const stem = typeof raw.stem === 'string' ? raw.stem : '';
  if (!stem.trim()) {
    return null;
  }
  const options = Array.isArray(raw.options)
    ? raw.options.filter((item): item is string => typeof item === 'string')
    : null;
  return {
    question_type: questionType,
    stem,
    options: options && options.length > 0 ? options : null,
  };
}

export function parseQuizPayload(input: string): Record<string, unknown> | null {
  return parseToolInput(input);
}

export function findPendingQuiz(
  message: Msg,
): { toolCallId: string; question: QuizQuestion } | null {
  for (const block of message.content) {
    if (block.type !== 'tool_call') {
      continue;
    }
    const call = block as ToolCallBlock;
    if (call.name !== QUIZ_TOOL_NAME || call.state !== 'submitted') {
      continue;
    }
    const question = quizQuestionFromInput(call.input);
    if (question) {
      return { toolCallId: call.id, question };
    }
  }
  return null;
}

export function collectPendingHitl(messages: ChatMessage[]): PendingHitl[] {
  const pending: PendingHitl[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') {
      continue;
    }
    for (const block of message.content) {
      if (block.type !== 'tool_call') {
        continue;
      }
      const call = block as ToolCallBlock;
      if (call.name !== QUIZ_TOOL_NAME || call.state !== 'submitted') {
        continue;
      }
      const question = quizQuestionFromInput(call.input);
      if (!question) {
        continue;
      }
      pending.push({
        replyId: message.id,
        toolCallId: call.id,
        kind: 'quiz',
        question,
        submittedAt: null,
      });
    }
  }
  return pending;
}

export function collectPendingConfirm(messages: ChatMessage[]): PendingConfirm | null {
  for (let position = messages.length - 1; position >= 0; position -= 1) {
    const message = messages[position];
    if (message.role !== 'assistant') {
      continue;
    }
    const asking = message.content.filter(
      (block): block is ToolCallBlock => block.type === 'tool_call' && block.state === 'asking',
    );
    if (asking.length > 0) {
      return {
        replyId: message.id,
        toolCalls: asking.map((call) => ({ id: call.id, name: call.name, input: call.input })),
        submittedAt: null,
      };
    }
  }
  return null;
}

function systemNote(text: string): ChatMessage {
  return createMsg({
    name: 'system',
    role: 'system',
    content: truncate(text, MAX_SYSTEM_NOTE_CHARS),
  });
}

function patchDataBlockUrl(
  message: ChatMessage,
  blockId: string,
  url: string,
  mediaType: string,
): void {
  const block = message.content.find(
    (item): item is DataBlock => item.type === 'data' && item.id === blockId,
  );
  if (block) {
    block.source = { type: 'url', url, media_type: mediaType };
  }
}

export function applyEvents(runtime: ChatRuntime, events: AgentEvent[]): ChatRuntime {
  if (events.length === 0) {
    return runtime;
  }

  const next: ChatRuntime = {
    ...runtime,
    messages: runtime.messages.slice(),
    index: { ...runtime.index },
    seenEventIds: new Set(runtime.seenEventIds),
    seenOrder: runtime.seenOrder.slice(),
  };
  const drafts = new Map<string, ChatMessage>();
  const created: string[] = [];
  let changed = false;

  const touch = (replyId: string, factory?: () => ChatMessage): ChatMessage | null => {
    const existing = drafts.get(replyId);
    if (existing) {
      return existing;
    }
    const position = next.index[replyId];
    if (position !== undefined) {
      const cloned = cloneMessage(next.messages[position]);
      drafts.set(replyId, cloned);
      return cloned;
    }
    if (!factory) {
      return null;
    }
    const message = factory();
    drafts.set(replyId, message);
    created.push(replyId);
    return message;
  };

  for (const event of events) {
    if (event.id) {
      if (next.seenEventIds.has(event.id)) {
        continue;
      }
      next.seenEventIds.add(event.id);
      next.seenOrder.push(event.id);
      if (next.seenOrder.length > SEEN_LIMIT) {
        const dropped = next.seenOrder.splice(0, next.seenOrder.length - SEEN_LIMIT);
        for (const id of dropped) {
          next.seenEventIds.delete(id);
        }
      }
    }

    if (event.type === 'EXCEED_MAX_ITERS') {
      next.messages.push(systemNote('本轮达到最大步数，已保留已生成的内容。'));
      changed = true;
      continue;
    }

    if (!('reply_id' in event)) {
      continue;
    }

    if (event.type === 'REPLY_START') {
      const message = touch(event.reply_id, () =>
        createAssistantMessage(event.reply_id, event.name ?? 'assistant'),
      );
      if (message) {
        message.name = event.name || message.name;
      }
      changed = true;
      next.phase = 'running';
      next.error = null;
      continue;
    }

    const message = touch(event.reply_id, () =>
      createAssistantMessage(event.reply_id, 'assistant'),
    );
    if (!message) {
      continue;
    }

    if (
      message.finished_at &&
      event.type !== 'REQUIRE_EXTERNAL_EXECUTION' &&
      event.type !== 'REQUIRE_USER_CONFIRM'
    ) {
      continue;
    }

    if (event.type === 'REQUIRE_EXTERNAL_EXECUTION') {
      const quizCall = event.tool_calls.find((call) => call.name === QUIZ_TOOL_NAME);
      if (quizCall) {
        const question = quizQuestionFromInput(quizCall.input);
        if (question) {
          next.pendingHitl = {
            replyId: message.id,
            toolCallId: quizCall.id,
            kind: 'quiz',
            question,
            submittedAt: null,
          };
        }
      }
      next.phase = 'awaiting_external_result';
    } else if (event.type === 'REQUIRE_USER_CONFIRM') {
      next.pendingConfirm = {
        replyId: message.id,
        toolCalls: event.tool_calls.map((call) => ({
          id: call.id,
          name: call.name,
          input: call.input,
        })),
        submittedAt: null,
      };
      next.phase = 'awaiting_permission';
    }

    appendEvent(message, event);
    changed = true;

    if (event.type === 'DATA_BLOCK_DELTA') {
      const dataUrl = (event as { url?: string }).url;
      if (dataUrl) {
        patchDataBlockUrl(message, event.block_id, dataUrl, event.media_type);
      }
    }

    if (event.type === 'REPLY_END') {
      if (event.finished_reason === 'error') {
        next.phase = 'error';
        next.error = event.error?.message ?? '本轮生成失败，请重试';
      } else {
        next.phase = 'idle';
        next.error = null;
      }
      next.pendingHitl = null;
      next.pendingConfirm = null;
    }

    if (event.type === 'TOOL_RESULT_END') {
      const stillPending = findPendingQuiz(message);
      if (stillPending) {
        next.pendingHitl = {
          replyId: message.id,
          toolCallId: stillPending.toolCallId,
          kind: 'quiz',
          question: stillPending.question,
          submittedAt: null,
        };
      } else if (next.pendingHitl?.toolCallId === event.tool_call_id) {
        next.pendingHitl = null;
        if (next.phase === 'awaiting_external_result') {
          next.phase = 'running';
        }
      }
    }
  }

  if (!changed) {
    return runtime;
  }

  for (const replyId of created) {
    const message = drafts.get(replyId);
    if (!message) {
      continue;
    }
    next.messages.push(message);
    next.index[replyId] = next.messages.length - 1;
  }
  for (const [replyId, message] of drafts) {
    const position = next.index[replyId];
    if (position !== undefined && !created.includes(replyId)) {
      next.messages[position] = message;
    }
  }

  return next;
}

export function phaseFromStatus(
  status: 'running' | 'idle' | 'awaiting_permission' | 'awaiting_external_result',
): SessionPhase {
  switch (status) {
    case 'running':
      return 'running';
    case 'awaiting_external_result':
      return 'awaiting_external_result';
    case 'awaiting_permission':
      return 'awaiting_permission';
    default:
      return 'idle';
  }
}
