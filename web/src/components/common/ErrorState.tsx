import { Button } from 'antd';
import { TriangleAlert } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title = '加载失败',
  message = '请检查网络后重试',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-panel border border-warning-line/70 bg-warning-soft/45 px-6 text-center ${
        compact ? 'py-6' : 'py-10'
      }`}
    >
      <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-surface text-warning">
        <TriangleAlert className="size-4" aria-hidden="true" />
      </span>
      <p className="m-0 text-[13.5px] font-medium text-ink">{title}</p>
      <p className="mt-1 mb-0 max-w-[420px] text-[12.5px] leading-6 text-ink-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-4" size="small" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </div>
  );
}
