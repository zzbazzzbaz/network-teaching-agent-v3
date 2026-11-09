import type { ReactNode } from 'react';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-0 w-full max-w-content flex-1 overflow-y-auto px-6 pt-6 pb-14 max-[767px]:px-3">
      {children}
    </div>
  );
}
