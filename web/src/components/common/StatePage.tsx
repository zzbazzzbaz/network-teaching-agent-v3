import type { ReactNode } from 'react';

export function StatePage({
  code,
  title,
  description,
  action,
}: {
  code: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] text-center">
        <p className="m-0 font-code text-[11px] tracking-[0.18em] text-ink-subtle">{code}</p>
        <h1 className="mt-3 mb-0 text-[24px] leading-tight font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h1>
        <p className="mt-2 mb-0 text-[13px] leading-6 text-ink-muted">{description}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
