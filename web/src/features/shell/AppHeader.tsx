import { MenuOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useLocation } from 'react-router';

import { useIsMobile } from '@/lib/use-media-query';
import { useUiStore } from '@/stores/ui-store';

const PAGE_TITLES: Record<string, string> = {
  '/memory': '记忆',
  '/questions': '题库',
  '/stats': '统计',
};

function resolveTitle(pathname: string): string {
  if (pathname === '/admin') {
    return '管理';
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
  if (pathname === '/admin/questions') {
    return '题目管理';
  }
  if (pathname.startsWith('/admin/questions/')) {
    return '题目详情';
  }
  if (pathname.startsWith('/questions/')) {
    return '题目详情';
  }
  return PAGE_TITLES[pathname] ?? '对话';
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
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface px-6 max-[767px]:px-3">
      <div className="flex min-w-0 items-center gap-2">
        {showSidebarToggle ? (
          <Button
            type="text"
            icon={isMobile ? <MenuOutlined /> : <MenuUnfoldOutlined />}
            onClick={openSidebar}
            aria-label={isMobile ? '打开导航' : '展开侧边栏'}
          />
        ) : null}
        <h1 className="truncate text-[15px] font-semibold">{pageTitle}</h1>
      </div>
    </header>
  );
}
