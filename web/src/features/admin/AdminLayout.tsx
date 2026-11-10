import { Button, Segmented } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { BrandLockup } from '@/components/common';

const NAV_ITEMS = [
  { label: '概览', value: '/admin' },
  { label: '学生管理', value: '/admin/users' },
  { label: '公共知识库', value: '/admin/knowledge' },
  { label: '教材内容', value: '/admin/materials' },
];

function activeNav(pathname: string): string {
  if (pathname.startsWith('/admin/users')) {
    return '/admin/users';
  }
  if (pathname.startsWith('/admin/knowledge')) {
    return '/admin/knowledge';
  }
  if (pathname.startsWith('/admin/materials')) {
    return '/admin/materials';
  }
  return '/admin';
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen min-h-0 flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="mx-auto flex h-[60px] w-full max-w-content items-center gap-3 px-6 max-[767px]:px-3">
          <BrandLockup size={28} subtitle={false} />
          <span className="h-4 w-px bg-line" aria-hidden="true" />
          <span className="text-[13px] font-medium text-ink-muted">管理后台</span>
          <Button
            className="ml-auto text-ink-muted"
            type="text"
            size="small"
            icon={<ArrowLeft className="size-3.5" />}
            onClick={() => navigate('/chat')}
          >
            返回工作台
          </Button>
        </div>
        <div className="mx-auto w-full max-w-content px-6 pb-3 max-[767px]:px-3">
          <Segmented
            value={activeNav(location.pathname)}
            onChange={(value) => navigate(String(value))}
            options={NAV_ITEMS}
          />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
