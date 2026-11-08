import { Tag } from 'antd';

import type { UserRole } from '@/api/types';

export function UserRoleTag({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return <Tag color="gold">管理员</Tag>;
  }
  return <Tag>学生</Tag>;
}

export function UserStatusTag({ status }: { status: 'active' | 'disabled' }) {
  if (status === 'disabled') {
    return <Tag color="red">已禁用</Tag>;
  }
  return <Tag color="green">正常</Tag>;
}
