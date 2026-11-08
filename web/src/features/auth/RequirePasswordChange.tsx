import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useAuthStore } from '@/stores/auth-store';

export function RequirePasswordChange({ children }: { children: ReactNode }) {
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
