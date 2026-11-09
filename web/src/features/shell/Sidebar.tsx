import {
  BookOutlined,
  ControlOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  KeyOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  PlusOutlined,
  ReadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Conversations } from '@ant-design/x';
import { Button, Dropdown, Skeleton, Tooltip, Typography, App } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { BrandMark, EmptyState } from '@/components/common';
import { useAuthStore } from '@/stores/auth-store';

import { useSessions } from './use-sessions';

const ACCOUNT_ITEMS = [
  { key: 'memory', label: '记忆', icon: <ReadOutlined />, path: '/memory' },
  { key: 'knowledge', label: '知识库', icon: <DatabaseOutlined />, path: '/knowledge' },
  { key: 'questions', label: '答题记录', icon: <BookOutlined />, path: '/questions' },
  { key: 'stats', label: '统计', icon: <LineChartOutlined />, path: '/stats' },
];

const ADMIN_ITEM = { key: 'admin', label: '管理', icon: <ControlOutlined />, path: '/admin' };

export function Sidebar({
  onNavigate,
  onCollapse,
}: {
  onNavigate?: () => void;
  onCollapse: () => void;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const { modal } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sessions = useSessions();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(sessions.loadMore);
  const hasMore = sessions.hasMore;

  useEffect(() => {
    loadMoreRef.current = sessions.loadMore;
  }, [sessions.loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRef.current();
        }
      },
      { rootMargin: '80px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  const conversationItems = useMemo(
    () =>
      sessions.items.map((session) => ({
        key: session.id,
        label: (
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{session.title}</span>
            {session.agent_kind === 'exam_agent' ? (
              <span className="shrink-0 rounded-chip bg-brand-soft px-1.5 py-0.5 text-[10px] leading-none text-brand">
                考研
              </span>
            ) : null}
          </span>
        ),
      })),
    [sessions.items],
  );

  const accountItems = useMemo(
    () => (user?.role === 'admin' ? [...ACCOUNT_ITEMS, ADMIN_ITEM] : ACCOUNT_ITEMS),
    [user?.role],
  );

  const handleCreate = () => {
    navigate('/chat');
    onNavigate?.();
  };

  const handleDelete = (sessionId: string) => {
    modal.confirm({
      title: '删除这个会话？',
      content: '会话内容与消息将不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const ok = await sessions.remove(sessionId);
        if (ok && params.sessionId === sessionId) {
          navigate('/chat');
        }
      },
    });
  };

  const menuFor = (sessionId: string) => ({
    items: [{ key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true }],
    onClick: ({
      key,
      domEvent,
    }: {
      key: string;
      domEvent: React.MouseEvent | React.KeyboardEvent;
    }) => {
      domEvent.stopPropagation();
      if (key === 'delete') {
        handleDelete(sessionId);
      }
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-4 pb-3">
      <div className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="shrink-0" />
          <div className="min-w-0">
            <Typography.Text strong className="block truncate">
              计算机网络
            </Typography.Text>
            <div className="truncate text-xs leading-tight text-ink-subtle">教学智能体</div>
          </div>
        </div>
        <Tooltip title="收起侧边栏">
          <Button
            className="-mr-1 shrink-0 text-ink-subtle"
            type="text"
            size="small"
            icon={<MenuFoldOutlined />}
            onClick={onCollapse}
            aria-label="收起侧边栏"
          />
        </Tooltip>
      </div>

      <Button
        className="mx-1 mb-3"
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleCreate}
        loading={sessions.isLoading && sessions.items.length === 0}
      >
        新建对话
      </Button>

      <div className="mx-2 my-3 h-px bg-line" />
      <div className="flex items-center justify-between px-2.5 pb-2 text-ink-subtle">
        <span className="data-text">会话</span>
        <span className="data-text">{sessions.total}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {sessions.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : sessions.isError ? (
          <div className="flex items-center justify-between px-2.5 py-2 text-[13px]">
            <Typography.Text type="secondary">会话列表加载失败</Typography.Text>
            <Button size="small" type="link" onClick={sessions.refetch}>
              重试
            </Button>
          </div>
        ) : sessions.items.length === 0 ? (
          <EmptyState
            title="还没有对话"
            description="点击「新建对话」开始第一个问题。"
            action={
              <Button size="small" onClick={handleCreate}>
                新建对话
              </Button>
            }
          />
        ) : (
          <>
            <Conversations
              className="bg-transparent"
              items={conversationItems}
              activeKey={params.sessionId}
              onActiveChange={(key) => {
                navigate(`/chat/${key}`);
                onNavigate?.();
              }}
              menu={(value) => menuFor(String(value.key))}
            />
            <div ref={sentinelRef} className="h-px" />
            {sessions.loadingMore ? (
              <Typography.Text type="secondary" className="block py-2 text-center text-xs">
                正在加载更多
              </Typography.Text>
            ) : null}
            {!sessions.hasMore && sessions.items.length > 0 ? (
              <Typography.Text type="secondary" className="block py-2 text-center text-xs">
                没有更多会话了
              </Typography.Text>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-line pt-2.5">
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              ...accountItems.map((item) => ({
                key: item.key,
                label: item.label,
                icon: item.icon,
              })),
              { key: 'password', label: '修改密码', icon: <KeyOutlined /> },
              { type: 'divider' },
              { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
            ],
            onClick: ({ key }) => {
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
              const target = accountItems.find((item) => item.key === key);
              if (target) {
                navigate(target.path);
                onNavigate?.();
              }
            },
          }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-chip px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            <UserOutlined />
            <span>{user?.username ?? '未登录'}</span>
          </button>
        </Dropdown>
      </div>

    </div>
  );
}
