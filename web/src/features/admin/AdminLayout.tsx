import { Segmented } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';

const NAV_ITEMS = [
  { label: '概览', value: '/admin' },
  { label: '学生管理', value: '/admin/users' },
  { label: '题目管理', value: '/admin/questions' },
];

function activeNav(pathname: string): string {
  if (pathname.startsWith('/admin/users')) {
    return '/admin/users';
  }
  if (pathname.startsWith('/admin/questions')) {
    return '/admin/questions';
  }
  return '/admin';
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line bg-surface px-6 py-3 max-[767px]:px-3">
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
