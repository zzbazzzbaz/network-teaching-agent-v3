import { toErrorMessage } from '@/api/client';
import { submitSessionEvent } from '@/api/messages';
import { parseQuizPayload, quizQuestionFromInput } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

export function canAnswerQuiz(input: string): boolean {
  return quizQuestionFromInput(input) !== null;
}

export async function submitQuizAnswer(params: {
  replyId: string;
  toolCallId: string;
  rawInput: string;
  answer: string;
}): Promise<void> {
  const runtime = useChatStore.getState().runtime;
  if (!runtime) {
    throw new Error('会话尚未就绪');
  }
  const question = parseQuizPayload(params.rawInput);
  if (!question) {
    throw new Error('题目数据缺失，无法作答');
  }

  const store = useChatStore.getState();
  store.beginHitlSubmit(params.toolCallId);
  try {
    await submitSessionEvent(runtime.sessionId, {
      type: 'EXTERNAL_EXECUTION_RESULT',
      reply_id: params.replyId,
      execution_results: [
        {
          type: 'tool_result',
          id: params.toolCallId,
          name: 'quiz_student',
          output: 'submitted',
          state: 'success',
          metadata: {
            answer: params.answer,
            question,
          },
        },
      ],
    });
    store.finishHitlSubmit(params.toolCallId);
    store.setPhase('running');
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'status' in error && error.status === 409
        ? '上一轮还在生成，请稍后重试'
        : toErrorMessage(error, '提交失败，请重试');
    store.failHitlSubmit(params.toolCallId, message);
    throw error;
  }
}

export async function submitConfirmResult(params: {
  replyId: string;
  toolCalls: Array<{ id: string; name: string; input: string }>;
  confirmed: boolean;
}): Promise<void> {
  const runtime = useChatStore.getState().runtime;
  if (!runtime) {
    throw new Error('会话尚未就绪');
  }
  const store = useChatStore.getState();
  const key = params.toolCalls[0]?.id ?? params.replyId;
  store.beginHitlSubmit(key);
  try {
    await submitSessionEvent(runtime.sessionId, {
      type: 'USER_CONFIRM_RESULT',
      reply_id: params.replyId,
      confirm_results: params.toolCalls.map((call) => ({
        confirmed: params.confirmed,
        tool_call: {
          type: 'tool_call',
          id: call.id,
          name: call.name,
          input: call.input,
        },
      })),
    });
    store.finishHitlSubmit(key);
    store.setPhase('running');
  } catch (error) {
    store.failHitlSubmit(key, toErrorMessage(error, '提交失败，请重试'));
    throw error;
  }
}
