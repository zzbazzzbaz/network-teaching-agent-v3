import { cn } from '@/lib/cn';

export interface BrandMarkProps {
  size?: number;
  tone?: 'default' | 'dark';
  className?: string;
}

export function BrandMark({ size = 32, tone = 'default', className }: BrandMarkProps) {
  const dark = tone === 'dark';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[7px] border',
        dark
          ? 'border-white/15 bg-white/[0.07] text-white'
          : 'border-line bg-surface text-brand',
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label="链路"
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        fill="none"
        aria-hidden="true"
      >
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3.5 6.5h17" opacity="0.35" />
          <path d="M3.5 12h17" opacity="0.6" />
          <path d="M3.5 17.5h17" />
        </g>
        <g fill="currentColor">
          <circle cx="8" cy="6.5" r="1.9" opacity="0.45" />
          <circle cx="14.5" cy="12" r="1.9" opacity="0.75" />
          <circle cx="19" cy="17.5" r="1.9" />
        </g>
      </svg>
    </span>
  );
}

export function BrandLockup({
  tone = 'default',
  size = 32,
  subtitle = true,
  className,
}: {
  tone?: 'default' | 'dark';
  size?: number;
  subtitle?: boolean;
  className?: string;
}) {
  const dark = tone === 'dark';

  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark size={size} tone={tone} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            'block truncate text-[15px] font-semibold tracking-[-0.012em]',
            dark ? 'text-white' : 'text-ink',
          )}
        >
          链路
        </span>
        {subtitle ? (
          <span
            className={cn(
              'mt-0.5 block truncate text-[10.5px]',
              dark ? 'text-white/55' : 'text-ink-subtle',
            )}
          >
            计算机网络教学智能体
          </span>
        ) : null}
      </span>
    </span>
  );
}
