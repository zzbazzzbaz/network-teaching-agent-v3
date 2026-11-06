import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { PageLoading } from '@/components/common';
import { useAuthStore } from '@/stores/auth-store';

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoading text="正在恢复登录状态" />;
  }

  if (status === 'unauthenticated') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
