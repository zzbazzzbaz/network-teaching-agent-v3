import type { ReactNode } from 'react';

import { PageLoading } from '@/components/common';
import { ForbiddenPage } from '@/pages/forbidden';
import { useAuthStore } from '@/stores/auth-store';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'loading') {
    return <PageLoading text="正在校验权限" />;
  }

  if (user?.role !== 'admin') {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
