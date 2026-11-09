import { Button } from 'antd';
import { Menu, PanelLeftOpen } from 'lucide-react';
import { useLocation } from 'react-router';

import { useIsMobile } from '@/lib/use-media-query';
import { useUiStore } from '@/stores/ui-store';

const PAGE_TITLES: Record<string, string> = {
  '/memory': '记忆',
  '/knowledge': '知识库',
  '/questions': '答题记录',
  '/stats': '统计',
};

function resolveTitle(pathname: string): string {
  if (pathname === '/admin') {
    return '管理概览';
  }
  if (pathname === '/admin/users') {
    return '学生管理';
  }
  if (pathname.startsWith('/admin/users/') && pathname.includes('/sessions/')) {
    return '会话详情';
  }
  if (pathname.startsWith('/admin/users/')) {
    return '学生详情';
  }
  if (pathname === '/admin/knowledge') {
    return '公共知识库';
  }
  if (pathname.startsWith('/questions/')) {
    return '答题详情';
  }
  return PAGE_TITLES[pathname] ?? '页面';
}

export function AppHeader() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const pageTitle = resolveTitle(location.pathname);
  const showSidebarToggle = isMobile || sidebarCollapsed;

  const openSidebar = () => {
    if (isMobile) {
      toggleSidebar();
      return;
    }
    setSidebarCollapsed(false);
  };

  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-line bg-surface">
      <div className="mx-auto flex h-[60px] w-full max-w-content items-center gap-2 px-6 max-[767px]:px-3">
        {showSidebarToggle ? (
          <Button
            className="-ml-1 shrink-0 text-ink-muted"
            type="text"
            icon={isMobile ? <Menu className="size-4" /> : <PanelLeftOpen className="size-4" />}
            onClick={openSidebar}
            aria-label={isMobile ? '打开导航' : '展开侧边栏'}
          />
        ) : null}
        <h1 className="min-w-0 truncate text-[20px] leading-tight font-semibold tracking-[-0.012em] text-ink">
          {pageTitle}
        </h1>
      </div>
    </header>
  );
}
