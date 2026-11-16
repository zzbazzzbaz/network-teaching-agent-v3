import type { MenuProps } from 'antd';
import {
  BookOpen,
  Database,
  KeyRound,
  Library,
  LineChart,
  ListChecks,
  LogOut,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';
import { useNavigate } from 'react-router';

import { useAuthStore } from '@/stores/auth-store';

export interface AccountMenuEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  external?: boolean;
  danger?: boolean;
}

const COURSE_ENTRY: AccountMenuEntry = {
  key: 'learn',
  label: '课程内容',
  icon: Library,
  path: '/learn',
  external: true,
};

const ACCOUNT_ENTRIES: AccountMenuEntry[] = [
  { key: 'memory', label: '记忆', icon: BookOpen, path: '/memory' },
  { key: 'knowledge', label: '知识库', icon: Database, path: '/knowledge' },
  { key: 'questions', label: '答题记录', icon: ListChecks, path: '/questions' },
  { key: 'stats', label: '统计', icon: LineChart, path: '/stats' },
];

const ADMIN_ENTRY: AccountMenuEntry = {
  key: 'admin',
  label: '后台管理',
  icon: Settings2,
  path: '/admin',
  external: true,
};

const SETTINGS_ENTRIES: AccountMenuEntry[] = [
  { key: 'password', label: '修改密码', icon: KeyRound },
  { key: 'logout', label: '退出登录', icon: LogOut, danger: true },
];

function toMenuItems(entries: AccountMenuEntry[]): NonNullable<MenuProps['items']> {
  return entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: createElement(entry.icon, { size: 13 }),
    danger: entry.danger,
  }));
}

export function useAccountMenu(onNavigate?: () => void) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const sections: AccountMenuEntry[][] = [
    [COURSE_ENTRY],
    ACCOUNT_ENTRIES,
    user?.role === 'admin' ? [ADMIN_ENTRY, ...SETTINGS_ENTRIES] : SETTINGS_ENTRIES,
  ];

  const items: NonNullable<MenuProps['items']> = [];
  sections.forEach((section, index) => {
    if (index > 0) {
      items.push({ type: 'divider' });
    }
    items.push(...toMenuItems(section));
  });

  const select = (key: string) => {
    if (key === 'logout') {
      logout();
      navigate('/login', { replace: true });
      return;
    }
    if (key === 'password') {
      navigate('/change-password');
      onNavigate?.();
      return;
    }
    const entry = sections.flat().find((item) => item.key === key);
    if (!entry?.path) {
      return;
    }
    if (entry.external) {
      window.open(entry.path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(entry.path);
    onNavigate?.();
  };

  return {
    items,
    sections,
    select,
    displayName: user?.username ?? '未登录',
    roleLabel: user ? (user.role === 'admin' ? '管理员' : '学生') : '未登录',
  };
}
