import { MenuOutlined } from '@ant-design/icons';
import { Button, Drawer } from 'antd';
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import { PageLoading } from '@/components/common';
import { AppHeader } from '@/features/shell/AppHeader';
import { Sidebar } from '@/features/shell/Sidebar';
import { useIsMobile } from '@/lib/use-media-query';
import { useUiStore } from '@/stores/ui-store';

export function AppLayout() {
  const isMobile = useIsMobile();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const location = useLocation();
  const isChat = location.pathname.startsWith('/chat');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <div className="flex h-full min-h-0">
      {!isMobile ? (
        <aside className="sticky top-0 h-screen w-[264px] shrink-0 overflow-hidden border-r border-line bg-surface max-[1199px]:w-[220px]">
          <Sidebar />
        </aside>
      ) : (
        <Drawer
          placement="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          size={288}
          closable={false}
          styles={{ body: { padding: 0 } }}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </Drawer>
      )}

      <div className="relative flex h-screen min-w-0 flex-1 flex-col">
        {isChat ? null : <AppHeader />}
        {isChat && isMobile ? (
          <Button
            className="absolute top-2 left-2 z-20 border border-line bg-surface/90 shadow-[0_1px_4px_rgb(16_23_32/10%)] backdrop-blur-sm"
            type="text"
            size="small"
            icon={<MenuOutlined />}
            onClick={toggleSidebar}
            aria-label="打开导航"
          />
        ) : null}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={<PageLoading text="正在加载页面" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
