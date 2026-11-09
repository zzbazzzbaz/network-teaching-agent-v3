import { Tooltip } from 'antd';
import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tooltip?: ReactNode;
}

export function MetricCard({ label, value, hint, tooltip }: MetricCardProps) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center gap-1 text-[11.5px] leading-5 text-ink-muted">
        <span>{label}</span>
        {tooltip ? (
          <Tooltip title={tooltip}>
            <span
              className="inline-flex cursor-help items-center rounded-full text-ink-subtle transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
              tabIndex={0}
              aria-label={`${label}统计口径`}
            >
              <CircleHelp className="size-3" aria-hidden="true" />
            </span>
          </Tooltip>
        ) : null}
      </div>
      <div className="mt-2 font-code text-[24px] leading-none tracking-[-0.02em] tabular-nums text-ink max-[767px]:text-[20px]">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-[10.5px] text-ink-subtle">{hint}</div> : null}
    </div>
  );
}
