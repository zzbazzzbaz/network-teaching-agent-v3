import { App as AntdApp } from 'antd';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';

import { useAuthStore } from '@/stores/auth-store';

import { router } from './router';
import styles from './App.module.css';

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
      <div className={styles.boot} role="status" aria-live="polite">
        <span className={styles.bootMark}>CN</span>
        <span className="data-text">正在恢复登录状态</span>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
