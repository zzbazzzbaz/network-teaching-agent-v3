import { App as AntdApp } from 'antd';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';

import { BrandLockup } from '@/components/common';
import { useAuthStore } from '@/stores/auth-store';

import { router } from './router';

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const status = useAuthStore((state) => state.status);
  const notice = useAuthStore((state) => state.notice);
  const setNotice = useAuthStore((state) => state.setNotice);
  const { message } = AntdApp.useApp();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    message.warning(notice);
    setNotice(null);
  }, [message, notice, setNotice]);

  if (status === 'loading') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 text-ink-subtle"
        role="status"
        aria-live="polite"
      >
        <BrandLockup size={32} />
        <span className="text-[12px] text-ink-muted">正在恢复登录状态</span>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
