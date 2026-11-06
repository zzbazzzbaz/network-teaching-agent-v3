import { Alert, Button, Typography } from 'antd';

import { useChatActions } from '@/features/chat/chat-actions';
import type { PendingConfirm } from '@/lib/agentscope/project';
import { useChatStore } from '@/stores/chat-store';

import { submitConfirmResult } from './submit';
import styles from './ConfirmCard.module.css';

const TOOL_LABELS: Record<string, string> = {
  quiz_student: '检查题',
  get_question: '读取题目',
  memory_search: '检索学习记忆',
  search_knowledge: '检索知识库',
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
    <section className={styles.card} aria-label="工具确认">
      <div className={styles.header}>
        <Typography.Text strong>需要确认</Typography.Text>
      </div>
      <Typography.Text type="secondary">
        本轮要执行以下操作：
        {pending.toolCalls.map((call) => TOOL_LABELS[call.name] ?? '外部工具').join('、')}
      </Typography.Text>
      {entry?.error ? <Alert type="error" showIcon message={entry.error} /> : null}
      <div className={styles.footer}>
        <Button onClick={stop}>终止本轮</Button>
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
