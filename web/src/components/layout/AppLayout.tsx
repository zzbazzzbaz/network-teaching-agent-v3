import { Button, Drawer } from 'antd';
import { Menu, PanelLeftOpen } from 'lucide-react';
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
  const isLearn = location.pathname.startsWith('/learn');

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
      {isLearn ? null : !isMobile ? (
        <aside
          className={`sticky top-0 h-screen shrink-0 overflow-hidden border-r border-line bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none ${
            sidebarCollapsed ? 'w-0 border-r-0' : 'w-[280px] max-[1199px]:w-[248px]'
          }`}
          inert={sidebarCollapsed}
        >
          <div className="h-full w-[280px] max-[1199px]:w-[248px]">
            <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
          </div>
        </aside>
      ) : (
        <Drawer
          placement="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          size={300}
          closable={false}
          styles={{ body: { padding: 0 } }}
        >
          <Sidebar
            onNavigate={() => setSidebarOpen(false)}
            onCollapse={() => setSidebarOpen(false)}
          />
        </Drawer>
      )}

      <div
        className={`relative flex h-screen min-w-0 flex-1 flex-col ${
          isChat ? 'bg-surface' : 'bg-canvas'
        }`}
      >
        {isChat ? null : <AppHeader />}
        {isChat && (isMobile || sidebarCollapsed) ? (
          <Button
            className="absolute top-3 left-3 z-20 border border-line bg-surface/90 shadow-[0_2px_8px_rgb(18_26_28/10%)] backdrop-blur-sm"
            type="text"
            size="small"
            icon={isMobile ? <Menu className="size-4" /> : <PanelLeftOpen className="size-4" />}
            onClick={openSidebar}
            aria-label={isMobile ? '打开导航' : '展开侧边栏'}
          />
        ) : null}
        <main
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            isChat && (isMobile || sidebarCollapsed) ? 'pt-12' : ''
          }`}
        >
          <Suspense fallback={<PageLoading text="正在加载页面" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
