import { MenuOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
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
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const location = useLocation();
  const isChat = location.pathname.startsWith('/chat');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const openSidebar = () => {
    if (isMobile) {
      toggleSidebar();
      return;
    }
    setSidebarCollapsed(false);
  };

  return (
    <div className="flex h-full min-h-0">
      {!isMobile ? (
        <aside
          className={`sticky top-0 h-screen shrink-0 overflow-hidden bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none ${
            sidebarCollapsed ? 'w-0' : 'w-[264px] border-r border-line max-[1199px]:w-[220px]'
          }`}
          inert={sidebarCollapsed}
        >
          <div className="h-full w-[264px] max-[1199px]:w-[220px]">
            <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
          </div>
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
          <Sidebar
            onNavigate={() => setSidebarOpen(false)}
            onCollapse={() => setSidebarOpen(false)}
          />
        </Drawer>
      )}

      <div className="relative flex h-screen min-w-0 flex-1 flex-col">
        {isChat ? null : <AppHeader />}
        {isChat && (isMobile || sidebarCollapsed) ? (
          <Button
            className="absolute top-2 left-2 z-20 border border-line bg-surface/90 shadow-[0_1px_4px_rgb(16_23_32/10%)] backdrop-blur-sm"
            type="text"
            size="small"
            icon={isMobile ? <MenuOutlined /> : <MenuUnfoldOutlined />}
            onClick={openSidebar}
            aria-label={isMobile ? '打开导航' : '展开侧边栏'}
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
