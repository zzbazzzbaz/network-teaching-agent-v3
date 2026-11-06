import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/messages', () => ({
  submitSessionEvent: vi.fn(async () => ({ status: 'started', session_id: 'session-1' })),
}));

import { submitSessionEvent } from '@/api/messages';
import { createRuntime } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { submitQuizAnswer } from './submit';

const quizInput = JSON.stringify({
  question_type: 'single_choice',
  stem: 'TCP 建连需要几次握手？',
  options: ['一次', '两次', '三次'],
  correct_option: 'C',
  reference_answer: null,
});

describe('检查题提交', () => {
  beforeEach(() => {
    vi.mocked(submitSessionEvent).mockClear();
    const runtime = createRuntime('session-1');
    useChatStore.setState({ runtime, hitl: {} });
  });

  it('提交体与后端 DTO 一致', async () => {
    await submitQuizAnswer({
      replyId: 'reply-1',
      toolCallId: 'call-1',
      rawInput: quizInput,
      answer: 'C',
    });

    expect(submitSessionEvent).toHaveBeenCalledTimes(1);
    const [sessionId, payload] = vi.mocked(submitSessionEvent).mock.calls[0] ?? [];
    expect(sessionId).toBe('session-1');
    expect(payload).toMatchObject({
      type: 'EXTERNAL_EXECUTION_RESULT',
      reply_id: 'reply-1',
      execution_results: [
        {
          type: 'tool_result',
          id: 'call-1',
          name: 'quiz_student',
          output: 'submitted',
          state: 'success',
          metadata: {
            answer: 'C',
            question: {
              question_type: 'single_choice',
              stem: 'TCP 建连需要几次握手？',
              options: ['一次', '两次', '三次'],
              correct_option: 'C',
              reference_answer: null,
            },
          },
        },
      ],
    });
  });

  it('提交成功后进入锁定状态', async () => {
    await submitQuizAnswer({
      replyId: 'reply-1',
      toolCallId: 'call-1',
      rawInput: quizInput,
      answer: 'C',
    });
    const entry = useChatStore.getState().hitl['call-1'];
    expect(entry?.submittedAt).toBeTypeOf('number');
    expect(entry?.submitting).toBe(false);
  });

  it('提交失败保留可重试状态', async () => {
    vi.mocked(submitSessionEvent).mockRejectedValueOnce(new Error('网络错误'));
    await expect(
      submitQuizAnswer({
        replyId: 'reply-1',
        toolCallId: 'call-1',
        rawInput: quizInput,
        answer: 'C',
      }),
    ).rejects.toThrow('网络错误');

    const entry = useChatStore.getState().hitl['call-1'];
    expect(entry?.submittedAt).toBeNull();
    expect(entry?.error).toBe('网络错误');
  });

  it('题目数据缺失时不发请求', async () => {
    await expect(
      submitQuizAnswer({
        replyId: 'reply-1',
        toolCallId: 'call-1',
        rawInput: '{broken',
        answer: 'C',
      }),
    ).rejects.toThrow('题目数据缺失');
    expect(submitSessionEvent).not.toHaveBeenCalled();
  });
});
