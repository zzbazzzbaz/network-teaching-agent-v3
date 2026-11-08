import { ArrowLeftOutlined, EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Skeleton, Space, Tabs, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { getUser, updateUser } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import { ErrorState, PageShell } from '@/components/common';
import {
  PasswordModal,
  UserFormModal,
  UserMemoryTab,
  UserOverviewTab,
  UserRoleTag,
  UserSessionsTab,
  UserStatusTag,
} from '@/features/admin';
import { formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

type TabKey = 'overview' | 'sessions' | 'memory';

function parseTab(value: string | null): TabKey {
  return value === 'sessions' || value === 'memory' ? value : 'overview';
}

export function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const currentUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  const [formOpen, setFormOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const userQuery = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => getUser(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });

  const user = userQuery.data;
  const isSelf = user?.id === currentUser?.id;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const toggleStatus = () => {
    if (!user) {
      return;
    }
    const disable = user.status === 'active';
    const apply = async () => {
      try {
        await updateUser(user.id, { status: disable ? 'disabled' : 'active' });
        message.success(disable ? '用户已禁用' : '用户已启用');
        refresh();
      } catch (error) {
        message.error(toErrorMessage(error, '操作失败'));
      }
    };
    if (!disable) {
      void apply();
      return;
    }
    modal.confirm({
      title: `禁用用户 ${user.username}？`,
      content: '禁用后该用户已登录的会话会在下一次请求时失效。',
      okText: '禁用',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: apply,
    });
  };

  const changeTab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'overview') {
      next.delete('tab');
    } else {
      next.set('tab', key);
    }
    setSearchParams(next, { replace: true });
  };

  if (userQuery.isLoading) {
    return (
      <PageShell>
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageShell>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <PageShell>
        <ErrorState
          title="用户加载失败"
          message={toErrorMessage(userQuery.error, '用户不存在或已被删除')}
          onRetry={() => void userQuery.refetch()}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <button
        type="button"
        className="mb-3 inline-flex items-center gap-1 rounded-chip py-1.5 text-sm text-ink-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={() => navigate('/admin/users')}
      >
        <ArrowLeftOutlined aria-hidden="true" />
        返回学生管理
      </button>

      <Card className="mb-5 border border-line" size="small">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Typography.Title level={4} className="m-0">
                {user.username}
              </Typography.Title>
              <UserRoleTag role={user.role} />
              <UserStatusTag status={user.status} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-muted">
              <span>注册时间：{formatDateTime(user.created_at)}</span>
              <span>最近活跃：{formatDateTime(user.last_active_at)}</span>
            </div>
          </div>
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={() => setFormOpen(true)}>
              编辑
            </Button>
            <Button icon={<LockOutlined />} onClick={() => setPasswordOpen(true)}>
              重置密码
            </Button>
            <Button
              danger={user.status === 'active'}
              disabled={isSelf}
              icon={user.status === 'active' ? <LockOutlined /> : <UnlockOutlined />}
              onClick={toggleStatus}
            >
              {user.status === 'active' ? '禁用' : '启用'}
            </Button>
          </Space>
        </div>
      </Card>

      <Tabs
        activeKey={tab}
        onChange={changeTab}
        items={[
          {
            key: 'overview',
            label: '概览',
            children: <UserOverviewTab userId={user.id} />,
          },
          {
            key: 'sessions',
            label: '会话',
            children: <UserSessionsTab userId={user.id} />,
          },
          {
            key: 'memory',
            label: '记忆',
            children: <UserMemoryTab userId={user.id} />,
          },
        ]}
      />

      <UserFormModal
        open={formOpen}
        user={user}
        isSelf={isSelf}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <PasswordModal
        open={passwordOpen}
        userId={user.id}
        username={user.username}
        onClose={() => setPasswordOpen(false)}
      />
    </PageShell>
  );
}
