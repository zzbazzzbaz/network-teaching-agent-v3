import { QuestionCircleOutlined } from '@ant-design/icons';
import { Card, Tooltip } from 'antd';
import type { ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tooltip?: ReactNode;
}

export function MetricCard({ label, value, hint, tooltip }: MetricCardProps) {
  return (
    <Card className="border border-line" size="small">
      <div className="mb-1.5 flex items-center gap-1 text-[13px] text-ink-muted">
        <span>{label}</span>
        {tooltip ? (
          <Tooltip title={tooltip}>
            <span
              className="inline-flex cursor-help items-center rounded-full text-ink-subtle transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
              tabIndex={0}
              aria-label={`${label}统计口径`}
            >
              <QuestionCircleOutlined />
            </span>
          </Tooltip>
        ) : null}
      </div>
      <div className="font-code text-2xl leading-tight tabular-nums max-[767px]:text-xl">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-ink-subtle">{hint}</div> : null}
    </Card>
  );
}
