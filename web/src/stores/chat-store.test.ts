import { describe, expect, it } from 'vitest';

import { createUserMessage, type ChatMessage } from '@/lib/agentscope/project';

import { reconcileMessages } from './chat-store';

function optimistic(text: string, createdAt: string): ChatMessage {
  return createUserMessage(text, { id: `local-${text}`, name: '学生', createdAt });
}

function server(text: string, createdAt: string): ChatMessage {
  return createUserMessage(text, { id: `server-${text}`, name: '学生', createdAt });
}

describe('乐观消息合并', () => {
  it('10 秒内的同文本消息视为已持久化，丢弃乐观消息', () => {
    const local = optimistic('什么是三次握手', '2026-11-06T10:00:00.000Z');
    const remote = server('什么是三次握手', '2026-11-06T10:00:04.000Z');
    const merged = reconcileMessages([local], [remote]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('server-什么是三次握手');
  });

  it('超过 10 秒的相同文本不会被误合并', () => {
    const local = optimistic('重复的问题', '2026-11-06T10:00:00.000Z');
    const remote = server('重复的问题', '2026-11-06T10:05:00.000Z');
    const merged = reconcileMessages([local], [remote]);
    expect(merged).toHaveLength(2);
  });

  it('未匹配到的乐观消息保留', () => {
    const local = optimistic('刚发出的问题', '2026-11-06T10:00:00.000Z');
    const merged = reconcileMessages([local], []);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.client_status).toBe('sending');
  });

  it('不同文本不合并', () => {
    const local = optimistic('A 问题', '2026-11-06T10:00:00.000Z');
    const remote = server('B 问题', '2026-11-06T10:00:01.000Z');
    expect(reconcileMessages([local], [remote])).toHaveLength(2);
  });
});
