import { App, Button, Dropdown, Tooltip } from 'antd';
import {
  BookOpen,
  ChevronsUpDown,
  Database,
  KeyRound,
  LineChart,
  ListChecks,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { BrandLockup } from '@/components/common';
import { formatSessionTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

import { useSessions } from './use-sessions';

const ACCOUNT_ITEMS = [
  { key: 'memory', label: '记忆', icon: BookOpen, path: '/memory' },
  { key: 'knowledge', label: '知识库', icon: Database, path: '/knowledge' },
  { key: 'questions', label: '答题记录', icon: ListChecks, path: '/questions' },
  { key: 'stats', label: '统计', icon: LineChart, path: '/stats' },
];

const ADMIN_ITEM = { key: 'admin', label: '管理', icon: Settings2, path: '/admin' };

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
    items: [{ key: 'delete', label: '删除会话', icon: <Trash2 size={13} />, danger: true }],
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

  const displayName = user?.username ?? '未登录';
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar px-3 pt-4 pb-3">
      <div className="flex items-center justify-between gap-2 px-1 pb-4">
        <BrandLockup />
        <Tooltip title="收起侧边栏">
          <Button
            className="-mr-1 shrink-0 text-ink-muted"
            type="text"
            size="small"
            icon={<PanelLeftClose size={15} />}
            onClick={onCollapse}
            aria-label="收起侧边栏"
          />
        </Tooltip>
      </div>

      <Button
        className="mx-0.5 h-9 justify-start border-line bg-surface px-3 text-[13px] font-medium text-ink-soft shadow-none hover:border-brand-line hover:text-brand-strong"
        icon={<Plus size={15} />}
        onClick={handleCreate}
        loading={sessions.isLoading && sessions.items.length === 0}
        block
      >
        新建对话
      </Button>

      <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-line pt-3">
        <div className="flex items-baseline justify-between px-1.5 pb-2">
          <span className="text-[11px] font-medium text-ink-muted">会话</span>
          <span className="font-code text-[10.5px] text-ink-subtle">{sessions.total}</span>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pb-2" aria-label="会话列表">
          {sessions.isLoading ? (
            <div className="space-y-1.5 px-0.5 pt-1">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-11 animate-pulse rounded-md bg-surface-sunken" />
              ))}
            </div>
          ) : sessions.isError ? (
            <div className="px-2 py-8 text-center">
              <p className="m-0 text-[12px] text-ink-muted">会话列表加载失败</p>
              <Button className="mt-3" size="small" onClick={sessions.refetch}>
                重试
              </Button>
            </div>
          ) : sessions.items.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="m-0 text-[12px] text-ink-muted">还没有对话</p>
              <p className="mt-1 mb-3 text-[11px] leading-5 text-ink-subtle">
                从一个具体问题开始。
              </p>
              <Button size="small" onClick={handleCreate}>
                新建对话
              </Button>
            </div>
          ) : (
            <>
              <ul className="space-y-0.5">
                {sessions.items.map((session) => {
                  const active = params.sessionId === session.id;
                  return (
                    <li key={session.id}>
                      <div className="group relative">
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/chat/${session.id}`);
                            onNavigate?.();
                          }}
                          aria-current={active ? 'page' : undefined}
                          className={`block w-full rounded-md border py-2 pr-9 pl-3 text-left transition-colors ${
                            active
                              ? 'border-line bg-surface shadow-[0_1px_2px_rgb(18_26_28/4%)]'
                              : 'border-transparent hover:bg-surface/70'
                          }`}
                        >
                          {active ? (
                            <span
                              aria-hidden="true"
                              className="absolute top-2.5 bottom-2.5 left-0 w-[2px] rounded-full bg-brand"
                            />
                          ) : null}
                          <span
                            className={`block truncate text-[12.5px] leading-5 ${
                              active ? 'font-medium text-ink' : 'text-ink-soft'
                            }`}
                          >
                            {session.title || '未命名对话'}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span className="font-code text-[9.5px] text-ink-subtle">
                              {formatSessionTime(session.last_message_at ?? session.created_at)}
                            </span>
                            {session.agent_kind === 'exam_agent' ? (
                              <span className="rounded-[3px] bg-brand-soft px-1 py-px text-[9px] leading-[14px] font-medium text-brand">
                                考研
                              </span>
                            ) : null}
                          </span>
                        </button>

                        <Dropdown
                          trigger={['click']}
                          menu={menuFor(session.id)}
                          placement="bottomRight"
                        >
                          <button
                            type="button"
                            aria-label={`管理会话「${session.title || '未命名对话'}」`}
                            className={`absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-subtle transition-opacity hover:bg-surface-sunken hover:text-ink focus-visible:opacity-100 ${
                              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <MoreHorizontal size={14} aria-hidden="true" />
                          </button>
                        </Dropdown>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div ref={sentinelRef} className="h-px" />
              {sessions.loadingMore ? (
                <p className="m-0 py-2 text-center text-[10.5px] text-ink-subtle">正在加载更多</p>
              ) : null}
              {!sessions.hasMore && sessions.items.length > 0 ? (
                <p className="m-0 py-2 text-center text-[10.5px] text-ink-subtle">没有更多会话了</p>
              ) : null}
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-line pt-2">
        <Dropdown
          trigger={['click']}
          placement="topLeft"
          menu={{
            items: [
              ...accountItems.map((item) => {
                const Icon = item.icon;
                return {
                  key: item.key,
                  label: item.label,
                  icon: <Icon size={13} />,
                };
              }),
              { key: 'password', label: '修改密码', icon: <KeyRound size={13} /> },
              { type: 'divider' },
              { key: 'logout', label: '退出登录', icon: <LogOut size={13} />, danger: true },
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
            aria-label="账户菜单"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-brand-line bg-brand-soft text-[11px] font-semibold text-brand-strong">
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
              {displayName}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
          </button>
        </Dropdown>
      </div>
    </div>
  );
}
