import { Alert, Button, Typography } from 'antd';

import { useChatActions } from '@/features/chat/chat-actions';
import type { PendingConfirm } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { submitConfirmResult } from './submit';

const TOOL_LABELS: Record<string, string> = {
  quiz_student: '检查题',
  get_question: '读取题目',
  memory_search: '检索学习记忆',
  materials_ls: '浏览资料',
  materials_read: '读取资料',
  materials_grep: '检索资料',
};

export function ConfirmCard({ pending }: { pending: PendingConfirm }) {
  const { stop } = useChatActions();
  const entry = useChatStore((state) => state.hitl[pending.toolCalls[0]?.id ?? pending.replyId]);
  const submitting = entry?.submitting ?? false;

  const handleConfirm = async (confirmed: boolean) => {
    try {
      await submitConfirmResult({
        replyId: pending.replyId,
        toolCalls: pending.toolCalls,
        confirmed,
      });
    } catch {
      return;
    }
  };

  return (
    <section
      className="overflow-hidden rounded-card border border-warning/35 bg-warning/[0.04]"
      aria-label="工具确认"
    >
      <div className="flex items-center gap-2 border-b border-warning/25 px-4 py-2">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        <span className="text-[11px] font-medium text-warning">需要确认</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <Typography.Text type="secondary" className="text-[13px]">
          本轮要执行以下操作：
          {pending.toolCalls.map((call) => TOOL_LABELS[call.name] ?? '外部工具').join('、')}
        </Typography.Text>
        {entry?.error ? <Alert type="error" showIcon message={entry.error} /> : null}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-warning/25 px-4 py-2.5 max-[767px]:flex-col-reverse">
        <Button type="text" onClick={stop}>
          终止本轮
        </Button>
        <Button danger loading={submitting} onClick={() => void handleConfirm(false)}>
          拒绝
        </Button>
        <Button type="primary" loading={submitting} onClick={() => void handleConfirm(true)}>
          允许
        </Button>
      </div>
    </section>
  );
}
