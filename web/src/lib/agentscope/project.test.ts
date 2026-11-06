import type { AgentEvent } from '@agentscope-ai/agentscope/event';
import { describe, expect, it } from 'vitest';

import {
  applyEvents,
  collectPendingHitl,
  createRuntime,
  findPendingQuiz,
  type ChatRuntime,
} from './project';

let counter = 0;

function event<T extends Record<string, unknown>>(payload: T): AgentEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    created_at: new Date(2026, 10, 6, 10, 0, counter).toISOString(),
    metadata: {},
    ...payload,
  } as unknown as AgentEvent;
}

function runtimeWith(events: AgentEvent[]): ChatRuntime {
  return applyEvents(createRuntime('session-1'), events);
}

describe('消息投影', () => {
  it('REPLY_START 创建助手消息，重复到达不重建', () => {
    const first = event({ type: 'REPLY_START', session_id: 's', reply_id: 'r1', name: '老师' });
    const runtime = runtimeWith([first]);
    expect(runtime.messages).toHaveLength(1);
    expect(runtime.messages[0]?.role).toBe('assistant');

    const again = event({ type: 'REPLY_START', session_id: 's', reply_id: 'r1', name: '老师' });
    const next = applyEvents(runtime, [again]);
    expect(next.messages).toHaveLength(1);
    expect(next.phase).toBe('running');
  });

  it('块事件先于 REPLY_START 到达不崩溃', () => {
    const runtime = runtimeWith([
      event({ type: 'TEXT_BLOCK_DELTA', reply_id: 'r2', block_id: 'missing', delta: 'x' }),
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r2', name: '老师' }),
    ]);
    expect(runtime.messages).toHaveLength(1);
    expect(runtime.index['r2']).toBe(0);
  });

  it('文本 delta 累加到同一块', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r3', name: '老师' }),
      event({ type: 'TEXT_BLOCK_START', reply_id: 'r3', block_id: 'b1' }),
      event({ type: 'TEXT_BLOCK_DELTA', reply_id: 'r3', block_id: 'b1', delta: '三次' }),
      event({ type: 'TEXT_BLOCK_DELTA', reply_id: 'r3', block_id: 'b1', delta: '握手' }),
    ]);
    const block = runtime.messages[0]?.content[0];
    expect(block).toMatchObject({ type: 'text', text: '三次握手' });
  });

  it('REPLY_END 后迟到的 delta 不追加', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r4', name: '老师' }),
      event({ type: 'TEXT_BLOCK_START', reply_id: 'r4', block_id: 'b1' }),
      event({ type: 'TEXT_BLOCK_DELTA', reply_id: 'r4', block_id: 'b1', delta: '结束' }),
      event({ type: 'REPLY_END', session_id: 's', reply_id: 'r4', finished_reason: 'completed' }),
      event({ type: 'TEXT_BLOCK_DELTA', reply_id: 'r4', block_id: 'b1', delta: '迟到' }),
    ]);
    const block = runtime.messages[0]?.content[0];
    expect(block).toMatchObject({ text: '结束' });
    expect(runtime.phase).toBe('idle');
  });

  it('同一事件 id 重复到达被去重', () => {
    const start = event({ type: 'REPLY_START', session_id: 's', reply_id: 'r5', name: '老师' });
    const runtime = runtimeWith([start, start]);
    expect(runtime.messages).toHaveLength(1);

    const replay = applyEvents(runtime, [start]);
    expect(replay).toBe(runtime);
  });

  it('REPLY_END 为 error 时进入错误态', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r6', name: '老师' }),
      event({
        type: 'REPLY_END',
        session_id: 's',
        reply_id: 'r6',
        finished_reason: 'error',
        error: { type: 'upstream', message: '模型超时' },
      }),
    ]);
    expect(runtime.phase).toBe('error');
    expect(runtime.error).toBe('模型超时');
  });

  it('EXCEED_MAX_ITERS 追加系统提示', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r7', name: '老师' }),
      event({ type: 'EXCEED_MAX_ITERS', reply_id: 'r7', name: '老师' }),
    ]);
    expect(runtime.messages.some((message) => message.role === 'system')).toBe(true);
  });
});

describe('HITL 投影', () => {
  const quizInput = JSON.stringify({
    question_type: 'single_choice',
    stem: 'TCP 建连需要几次握手？',
    options: ['一次', '两次', '三次'],
    correct_option: 'C',
    reference_answer: null,
  });

  it('REQUIRE_EXTERNAL_EXECUTION 生成待答题目，且题面不含答案', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r8', name: '老师' }),
      event({
        type: 'TOOL_CALL_START',
        reply_id: 'r8',
        tool_call_id: 'call-1',
        tool_call_name: 'quiz_student',
      }),
      event({ type: 'TOOL_CALL_DELTA', reply_id: 'r8', tool_call_id: 'call-1', delta: quizInput }),
      event({ type: 'TOOL_CALL_END', reply_id: 'r8', tool_call_id: 'call-1' }),
      event({
        type: 'REQUIRE_EXTERNAL_EXECUTION',
        reply_id: 'r8',
        tool_calls: [{ id: 'call-1', name: 'quiz_student', input: quizInput, type: 'tool_call' }],
      }),
    ]);

    expect(runtime.phase).toBe('awaiting_external_result');
    expect(runtime.pendingHitl?.toolCallId).toBe('call-1');
    expect(runtime.pendingHitl?.question.stem).toBe('TCP 建连需要几次握手？');
    expect(runtime.pendingHitl?.question.options).toEqual(['一次', '两次', '三次']);
    expect(JSON.stringify(runtime.pendingHitl?.question)).not.toContain('correct_option');
  });

  it('TOOL_RESULT_END 后待答状态清除并回到运行态', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r9', name: '老师' }),
      event({
        type: 'TOOL_CALL_START',
        reply_id: 'r9',
        tool_call_id: 'call-2',
        tool_call_name: 'quiz_student',
      }),
      event({ type: 'TOOL_CALL_DELTA', reply_id: 'r9', tool_call_id: 'call-2', delta: quizInput }),
      event({
        type: 'REQUIRE_EXTERNAL_EXECUTION',
        reply_id: 'r9',
        tool_calls: [{ id: 'call-2', name: 'quiz_student', input: quizInput, type: 'tool_call' }],
      }),
      event({
        type: 'TOOL_RESULT_START',
        reply_id: 'r9',
        tool_call_id: 'call-2',
        tool_call_name: 'quiz_student',
      }),
      event({
        type: 'TOOL_RESULT_TEXT_DELTA',
        reply_id: 'r9',
        tool_call_id: 'call-2',
        delta: '学生答案: C',
      }),
      event({ type: 'TOOL_RESULT_END', reply_id: 'r9', tool_call_id: 'call-2', state: 'success' }),
    ]);

    expect(runtime.pendingHitl).toBeNull();
    expect(runtime.phase).toBe('running');
    const call = runtime.messages[0]?.content.find((block) => block.type === 'tool_call');
    expect(call).toMatchObject({ state: 'finished' });
  });

  it('历史恢复只认 state=submitted 的检查题', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r10', name: '老师' }),
      event({
        type: 'TOOL_CALL_START',
        reply_id: 'r10',
        tool_call_id: 'call-3',
        tool_call_name: 'quiz_student',
      }),
      event({ type: 'TOOL_CALL_DELTA', reply_id: 'r10', tool_call_id: 'call-3', delta: quizInput }),
      event({
        type: 'REQUIRE_EXTERNAL_EXECUTION',
        reply_id: 'r10',
        tool_calls: [{ id: 'call-3', name: 'quiz_student', input: quizInput, type: 'tool_call' }],
      }),
    ]);

    const pending = collectPendingHitl(runtime.messages);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.replyId).toBe('r10');

    const finished = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r11', name: '老师' }),
      event({
        type: 'TOOL_CALL_START',
        reply_id: 'r11',
        tool_call_id: 'call-4',
        tool_call_name: 'quiz_student',
      }),
      event({ type: 'TOOL_CALL_DELTA', reply_id: 'r11', tool_call_id: 'call-4', delta: quizInput }),
      event({ type: 'TOOL_CALL_END', reply_id: 'r11', tool_call_id: 'call-4' }),
    ]);
    expect(collectPendingHitl(finished.messages)).toHaveLength(0);
  });

  it('多道检查题各自独立', () => {
    const runtime = runtimeWith([
      event({ type: 'REPLY_START', session_id: 's', reply_id: 'r12', name: '老师' }),
      event({
        type: 'TOOL_CALL_START',
        reply_id: 'r12',
        tool_call_id: 'call-5',
        tool_call_name: 'quiz_student',
      }),
      event({ type: 'TOOL_CALL_DELTA', reply_id: 'r12', tool_call_id: 'call-5', delta: quizInput }),
      event({
        type: 'TOOL_CALL_START',
        reply_id: 'r12',
        tool_call_id: 'call-6',
        tool_call_name: 'quiz_student',
      }),
      event({ type: 'TOOL_CALL_DELTA', reply_id: 'r12', tool_call_id: 'call-6', delta: quizInput }),
      event({
        type: 'REQUIRE_EXTERNAL_EXECUTION',
        reply_id: 'r12',
        tool_calls: [
          { id: 'call-5', name: 'quiz_student', input: quizInput, type: 'tool_call' },
          { id: 'call-6', name: 'quiz_student', input: quizInput, type: 'tool_call' },
        ],
      }),
    ]);

    const first = runtime.messages[0];
    expect(first).toBeDefined();
    expect(findPendingQuiz(first!)?.toolCallId).toBe('call-5');
  });
});
