import {
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MessageOutlined,
  PlusOutlined,
  ReadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Conversations } from '@ant-design/x';
import { Button, Dropdown, Menu, Modal, Input, Skeleton, Typography, App } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/common';
import { useAuthStore } from '@/stores/auth-store';

import { useSessions } from './use-sessions';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { key: 'chat', label: '对话', icon: <MessageOutlined />, path: '/chat' },
  { key: 'memory', label: '记忆', icon: <ReadOutlined />, path: '/memory' },
  { key: 'questions', label: '题库', icon: <BookOutlined />, path: '/questions' },
  { key: 'stats', label: '统计', icon: <LineChartOutlined />, path: '/stats' },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
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

  const activeSection = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path))?.key;

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

  const handleCreate = async () => {
    const created = await sessions.create();
    if (!created) {
      return;
    }
    navigate(`/chat/${created.id}`);
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
    <div className={styles.root}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>CN</span>
        <div>
          <Typography.Text strong>计算机网络</Typography.Text>
          <div className={styles.brandSub}>教学智能体</div>
        </div>
      </div>

      <Button
        className={styles.newButton}
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => void handleCreate()}
        loading={sessions.isLoading && sessions.items.length === 0}
      >
        新对话
      </Button>

      <Menu
        className={styles.nav}
        mode="inline"
        selectable
        selectedKeys={activeSection ? [activeSection] : []}
        items={NAV_ITEMS.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: item.label,
          onClick: () => {
            navigate(item.path);
            onNavigate?.();
          },
        }))}
      />

      <div className={styles.divider} />
      <div className={styles.listHeader}>
        <span className="data-text">会话</span>
        <span className="data-text">{sessions.total}</span>
      </div>

      <div className={styles.list}>
        {sessions.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : sessions.isError ? (
          <div className={styles.listError}>
            <Typography.Text type="secondary">会话列表加载失败</Typography.Text>
            <Button size="small" type="link" onClick={sessions.refetch}>
              重试
            </Button>
          </div>
        ) : sessions.items.length === 0 ? (
          <EmptyState
            title="还没有对话"
            description="点击「新对话」开始第一个问题。"
            action={
              <Button size="small" onClick={() => void handleCreate()}>
                新建会话
              </Button>
            }
          />
        ) : (
          <>
            <Conversations
              className={styles.conversations}
              items={conversationItems}
              activeKey={params.sessionId}
              onActiveChange={(key) => {
                navigate(`/chat/${key}`);
                onNavigate?.();
              }}
              menu={(value) => menuFor(String(value.key))}
            />
            <div ref={sentinelRef} className={styles.sentinel} />
            {sessions.loadingMore ? (
              <Typography.Text type="secondary" className={styles.loadingMore}>
                正在加载更多
              </Typography.Text>
            ) : null}
            {!sessions.hasMore && sessions.items.length > 0 ? (
              <Typography.Text type="secondary" className={styles.loadingMore}>
                没有更多会话了
              </Typography.Text>
            ) : null}
          </>
        )}
      </div>

      <div className={styles.user}>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [{ key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true }],
            onClick: ({ key }) => {
              if (key === 'logout') {
                logout();
                navigate('/login', { replace: true });
              }
            },
          }}
        >
          <button type="button" className={styles.userButton}>
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
