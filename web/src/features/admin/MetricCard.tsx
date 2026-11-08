import { Card } from 'antd';
import type { ReactNode } from 'react';

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="border border-line" size="small">
      <div className="mb-1.5 text-[13px] text-ink-muted">{label}</div>
      <div className="font-code text-2xl leading-tight tabular-nums max-[767px]:text-xl">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-ink-subtle">{hint}</div> : null}
    </Card>
  );
}
