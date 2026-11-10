import { Segmented } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-content shrink-0 px-6 pt-4 max-[767px]:px-3">
        <Segmented
          value={activeNav(location.pathname)}
          onChange={(value) => navigate(String(value))}
          options={NAV_ITEMS}
        />
      </div>
      <Outlet />
    </div>
  );
}
