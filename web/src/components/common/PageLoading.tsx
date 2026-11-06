import { Spin, Typography } from 'antd';

export function PageLoading({ text = '正在加载' }: { text?: string }) {
  return (
    <div
      className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 py-12"
      role="status"
      aria-live="polite"
    >
      <Spin />
      <Typography.Text type="secondary">{text}</Typography.Text>
    </div>
  );
}

export function InlineLoading({ text = '正在加载' }: { text?: string }) {
  return (
    <div
      className="flex items-center gap-2 py-3 text-[13px] text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <Spin size="small" />
      <span>{text}</span>
    </div>
  );
}
