import type { UserRole } from '@/api/types';

export function UserRoleTag({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-warning-line bg-warning-soft px-1.5 text-[10.5px] leading-[19px] font-medium text-warning">
        管理员
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-line bg-surface-sunken px-1.5 text-[10.5px] leading-[19px] font-medium text-ink-muted">
      学生
    </span>
  );
}

export function UserStatusTag({ status }: { status: 'active' | 'disabled' }) {
  if (status === 'disabled') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-danger-line bg-danger-soft px-1.5 text-[10.5px] leading-[19px] font-medium text-danger">
        已禁用
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-success-line bg-success-soft px-1.5 text-[10.5px] leading-[19px] font-medium text-success">
      正常
    </span>
  );
}
