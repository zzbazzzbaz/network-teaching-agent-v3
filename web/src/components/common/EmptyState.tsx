import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <svg
        viewBox="0 0 52 32"
        className="mb-1 h-8 w-12 text-brand-line"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 24 26 8l18 16M8 24h36M26 8v16"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="8" cy="24" r="2.4" fill="var(--surface)" stroke="currentColor" />
        <circle cx="44" cy="24" r="2.4" fill="var(--surface)" stroke="currentColor" />
        <circle cx="26" cy="8" r="2.8" fill="var(--brand-600)" />
      </svg>
      <p className="m-0 text-[13.5px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="m-0 max-w-[420px] text-[12.5px] leading-6 text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
