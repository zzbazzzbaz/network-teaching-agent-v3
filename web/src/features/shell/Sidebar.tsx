import {
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  LineChartOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Conversations } from '@ant-design/x';
import { Button, Dropdown, Modal, Input, Skeleton, Typography, App } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/common';
import { useAuthStore } from '@/stores/auth-store';

import { useSessions } from './use-sessions';

const ACCOUNT_ITEMS = [
  { key: 'memory', label: '记忆', icon: <ReadOutlined />, path: '/memory' },
  { key: 'questions', label: '题库', icon: <BookOutlined />, path: '/questions' },
  { key: 'stats', label: '统计', icon: <LineChartOutlined />, path: '/stats' },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const params = useParams();
  const { modal } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sessions = useSessions();
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
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
        label: session.title,
      })),
    [sessions.items],
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
    items: [
      { key: 'rename', label: '重命名', icon: <EditOutlined /> },
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({
      key,
      domEvent,
    }: {
      key: string;
      domEvent: React.MouseEvent | React.KeyboardEvent;
    }) => {
      domEvent.stopPropagation();
      const session = sessions.items.find((item) => item.id === sessionId);
      if (!session) {
        return;
      }
      if (key === 'rename') {
        setRenaming({ id: sessionId, title: session.title });
        setRenameValue(session.title);
        return;
      }
      if (key === 'delete') {
        handleDelete(sessionId);
      }
    },
  });

  const submitRename = async () => {
    if (!renaming) {
      return;
    }
    const ok = await sessions.rename(renaming.id, renameValue);
    if (ok) {
      setRenaming(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-4 pb-3">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-chip bg-brand font-code text-[13px] tracking-[0.5px] text-white">
          CN
        </span>
        <div>
          <Typography.Text strong>计算机网络</Typography.Text>
          <div className="text-xs leading-tight text-ink-subtle">教学智能体</div>
        </div>
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
              ...ACCOUNT_ITEMS.map((item) => ({
                key: item.key,
                label: item.label,
                icon: item.icon,
              })),
              { type: 'divider' },
              { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
            ],
            onClick: ({ key }) => {
              if (key === 'logout') {
                logout();
                navigate('/login', { replace: true });
                return;
              }
              const target = ACCOUNT_ITEMS.find((item) => item.key === key);
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

      <Modal
        open={Boolean(renaming)}
        title="重命名会话"
        okText="保存"
        cancelText="取消"
        onCancel={() => setRenaming(null)}
        onOk={() => void submitRename()}
        confirmLoading={false}
      >
        <Input
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          maxLength={255}
          placeholder="会话标题"
          onPressEnter={() => void submitRename()}
        />
      </Modal>
    </div>
  );
}
