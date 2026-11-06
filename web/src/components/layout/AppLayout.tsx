import { Drawer, Layout } from 'antd';
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import { PageLoading } from '@/components/common';
import { AppHeader } from '@/features/shell/AppHeader';
import { Sidebar } from '@/features/shell/Sidebar';
import { useIsMobile } from '@/lib/use-media-query';
import { useUiStore } from '@/stores/ui-store';

import styles from './AppLayout.module.css';

export function AppLayout() {
  const isMobile = useIsMobile();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <Layout className={styles.root} hasSider={!isMobile}>
      {!isMobile ? (
        <Layout.Sider width={264} className={styles.sider} theme="light">
          <Sidebar />
        </Layout.Sider>
      ) : (
        <Drawer
          placement="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={288}
          closable={false}
          styles={{ body: { padding: 0 } }}
          rootClassName={styles.drawer}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </Drawer>
      )}

      <Layout className={styles.main}>
        <AppHeader />
        <Layout.Content className={styles.content}>
          <Suspense fallback={<PageLoading text="正在加载页面" />}>
            <Outlet />
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
