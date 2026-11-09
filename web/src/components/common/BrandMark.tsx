import { useId } from 'react';

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const gradientId = `brand-mark-${useId().replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="计算机网络教学智能体"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1b7089" />
          <stop offset="1" stopColor="#0d4454" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="7.25"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.16"
        strokeWidth="1.5"
      />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 6.5 27.5 12 16 17.5 4.5 12Z" strokeWidth="1.6" />
        <path
          d="M9.8 15v3.2c0 2 2.8 3.6 6.2 3.6s6.2-1.6 6.2-3.6V15"
          strokeWidth="1.5"
          strokeOpacity="0.75"
        />
        <path d="M27.5 12v6.4" strokeWidth="1.3" strokeOpacity="0.7" />
        <path
          d="M16 12 16 6.5M16 12 27.5 12M16 12 16 17.5M16 12 4.5 12"
          strokeWidth="1"
          strokeOpacity="0.4"
        />
      </g>
      <g fill="#fff">
        <circle cx="16" cy="12" r="2.1" />
        <circle cx="16" cy="6.5" r="1.35" />
        <circle cx="27.5" cy="12" r="1.35" />
        <circle cx="16" cy="17.5" r="1.35" />
        <circle cx="4.5" cy="12" r="1.35" />
        <circle cx="27.5" cy="18.4" r="1.3" />
      </g>
    </svg>
  );
}
