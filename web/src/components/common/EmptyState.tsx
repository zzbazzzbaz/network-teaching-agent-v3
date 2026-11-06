import { Typography } from 'antd';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex h-7 items-end gap-1" aria-hidden="true">
        <span className="block h-3 w-1 rounded-full bg-line" />
        <span className="block h-[22px] w-1 rounded-full bg-brand-soft" />
        <span className="block h-4 w-1 rounded-full bg-line" />
      </div>
      <Typography.Text strong>{title}</Typography.Text>
      {description ? (
        <p className="m-0 max-w-[420px] text-[13px] leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
