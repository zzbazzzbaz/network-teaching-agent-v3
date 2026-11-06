import { App as AntdApp } from 'antd';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';

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
        <span className="inline-flex size-9 items-center justify-center rounded-chip bg-brand font-code text-[13px] text-white">
          CN
        </span>
        <span className="data-text">正在恢复登录状态</span>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
