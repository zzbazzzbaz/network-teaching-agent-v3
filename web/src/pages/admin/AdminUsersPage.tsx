import { EllipsisOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Dropdown,
  Input,
  List,
  Pagination,
  Select,
  Skeleton,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { listUsers, updateUserStatus, type AdminUserSort } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { AdminUserItem, UserRole } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { CreateUserModal, PasswordModal, UserRoleTag, UserStatusTag } from '@/features/admin';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useIsMobile } from '@/lib/use-media-query';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;

const SORTS: Array<{ label: string; value: AdminUserSort }> = [
  { label: '注册时间', value: 'created_at_desc' },
  { label: '最近活跃', value: 'last_active_desc' },
  { label: '用户名', value: 'username_asc' },
  { label: 'tokens', value: 'tokens_desc' },
  { label: '轮次', value: 'rounds_desc' },
  { label: '作答', value: 'answers_desc' },
  { label: '会话', value: 'sessions_desc' },
];

function parseRole(value: string | null): UserRole | 'all' {
  return value === 'admin' || value === 'all' ? value : 'student';
}

function parseStatus(value: string | null): 'active' | 'disabled' | undefined {
  return value === 'active' || value === 'disabled' ? value : undefined;
}

function parseSort(value: string | null): AdminUserSort {
  return SORTS.some((item) => item.value === value) ? (value as AdminUserSort) : 'created_at_desc';
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const currentUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const role = parseRole(searchParams.get('role'));
  const status = parseStatus(searchParams.get('status'));
  const sort = parseSort(searchParams.get('sort'));
  const query = searchParams.get('q') ?? '';
  const page = Math.max(Number(searchParams.get('page') ?? '1'), 1);

  const [keyword, setKeyword] = useState(query);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminUserItem | null>(null);

  useEffect(() => {
    setKeyword(query);
  }, [query]);

  useEffect(() => {
    if (keyword === query) {
      return;
    }
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (keyword) {
        next.set('q', keyword);
      } else {
        next.delete('q');
      }
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, query, searchParams, setSearchParams]);

  const listQuery = useQuery({
    queryKey: ['admin-users', { role, status, sort, query, page }],
    queryFn: () =>
      listUsers({
        q: query || undefined,
        role,
        status,
        sort,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    setSearchParams(next, { replace: true });
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-ranking'] });
  };

  const toggleStatus = (record: AdminUserItem) => {
    const disable = record.status === 'active';
    const apply = async () => {
      try {
        await updateUserStatus(record.id, disable ? 'disabled' : 'active');
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
      title: `禁用用户 ${record.username}？`,
      content: '禁用后该用户已登录的会话会在下一次请求时失效。',
      okText: '禁用',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: apply,
    });
  };

  const rowMenu = (record: AdminUserItem) => ({
    items: [
      { key: 'password', label: '重置密码' },
      { type: 'divider' as const },
      {
        key: 'toggle',
        label: record.status === 'active' ? '禁用' : '启用',
        danger: record.status === 'active',
        disabled: record.id === currentUser?.id,
      },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'password') {
        setPasswordTarget(record);
        return;
      }
      if (key === 'toggle') {
        toggleStatus(record);
      }
    },
  });

  const columns: ColumnsType<AdminUserItem> = [
    {
      title: '用户名',
      dataIndex: 'username',
      render: (username: string, record) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm text-brand hover:text-brand-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => navigate(`/admin/users/${record.id}`)}
        >
          {username}
        </button>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 90,
      render: (value: UserRole) => <UserRoleTag role={value} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: 'active' | 'disabled') => <UserStatusTag status={value} />,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 160,
      responsive: ['xl'],
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
    {
      title: '最近活跃',
      dataIndex: 'last_active_at',
      width: 160,
      responsive: ['lg'],
      render: (value: string | null) => <span className="data-text">{formatDateTime(value)}</span>,
    },
    {
      title: '会话',
      dataIndex: 'sessions',
      width: 80,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '轮次',
      dataIndex: 'rounds',
      width: 80,
      align: 'right',
      responsive: ['lg'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: 'tokens',
      dataIndex: 'tokens',
      width: 110,
      align: 'right',
      responsive: ['xl'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '作答',
      dataIndex: 'answers',
      width: 80,
      align: 'right',
      responsive: ['lg'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_value, record) => (
        <Dropdown menu={rowMenu(record)} trigger={['click']}>
          <Button type="text" size="small" icon={<EllipsisOutlined />} aria-label="更多操作" />
        </Dropdown>
      ),
    },
  ];

  const data = listQuery.data;

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[767px]:flex-col max-[767px]:items-stretch">
        <div className="flex flex-wrap items-center gap-2 max-[767px]:flex-col max-[767px]:items-stretch">
          <Input.Search
            allowClear
            className="w-[220px] max-[767px]:w-full"
            placeholder="搜索用户名"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            className="w-[130px] max-[767px]:w-full"
            value={role}
            onChange={(value) => updateParam('role', value === 'student' ? null : value)}
            options={[
              { label: '全部角色', value: 'all' },
              { label: '学生', value: 'student' },
              { label: '管理员', value: 'admin' },
            ]}
          />
          <Select
            allowClear
            className="w-[130px] max-[767px]:w-full"
            placeholder="全部状态"
            value={status}
            onChange={(value) => updateParam('status', value ?? null)}
            options={[
              { label: '正常', value: 'active' },
              { label: '已禁用', value: 'disabled' },
            ]}
          />
          <Select
            className="w-[150px] max-[767px]:w-full"
            value={sort}
            onChange={(value) => updateParam('sort', value === 'created_at_desc' ? null : value)}
            options={SORTS}
          />
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          创建用户
        </Button>
      </div>

      {listQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : listQuery.isError ? (
        <ErrorState
          title="用户列表加载失败"
          message={toErrorMessage(listQuery.error, '请稍后重试')}
          onRetry={() => void listQuery.refetch()}
          compact
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="没有匹配的用户"
          description="调整筛选条件，或创建一个新用户。"
          action={<Button onClick={() => setCreateOpen(true)}>创建用户</Button>}
        />
      ) : isMobile ? (
        <List
          className="overflow-hidden rounded-card border border-line bg-surface"
          dataSource={data.items}
          rowKey="id"
          renderItem={(item) => (
            <List.Item
              style={{ padding: '12px 16px' }}
              actions={[
                <Dropdown key="actions" menu={rowMenu(item)} trigger={['click']}>
                  <Button type="text" size="small" icon={<EllipsisOutlined />} aria-label="更多操作" />
                </Dropdown>,
              ]}
            >
              <div
                className="w-full cursor-pointer"
                onClick={() => navigate(`/admin/users/${item.id}`)}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Typography.Text strong>{item.username}</Typography.Text>
                  <UserRoleTag role={item.role} />
                  <UserStatusTag status={item.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle">
                  <span>会话 {formatNumber(item.sessions)}</span>
                  <span>轮次 {formatNumber(item.rounds)}</span>
                  <span>tokens {formatNumber(item.tokens)}</span>
                  <span>作答 {formatNumber(item.answers)}</span>
                  <span>最近活跃 {formatDateTime(item.last_active_at)}</span>
                </div>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data.items}
            pagination={false}
            className="bg-surface"
          />
        </div>
      )}

      {data && data.items.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            showSizeChanger={false}
            onChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </div>
      ) : null}

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />

      <PasswordModal
        open={Boolean(passwordTarget)}
        userId={passwordTarget?.id ?? null}
        username={passwordTarget?.username ?? null}
        onClose={() => setPasswordTarget(null)}
      />
    </PageShell>
  );
}
