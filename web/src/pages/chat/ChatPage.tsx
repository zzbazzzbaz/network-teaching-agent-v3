import { useQuery } from '@tanstack/react-query';
import { Button, Result } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { createSession, getSession } from '@/api/sessions';
import { ErrorState, PageLoading } from '@/components/common';
import { ChatActionsProvider } from '@/features/chat/chat-actions';
import { ChatComposer } from '@/features/chat/ChatComposer';
import { ComposerCard } from '@/features/chat/ComposerCard';
import { MessageList } from '@/features/chat/MessageList';
import { setOutbox, takeOutbox } from '@/features/chat/outbox';
import { useChatSession } from '@/features/chat/use-chat-session';
import { AttachmentThumbs } from '@/features/upload/AttachmentThumbs';
import { selectFiles } from '@/features/upload/file-rules';
import { useUploads } from '@/features/upload/use-uploads';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';

const PROMPTS = [
  { key: 'tcp', label: 'TCP 三次握手为什么不是两次？' },
  { key: 'congestion', label: '拥塞控制的四个阶段分别做什么？' },
  { key: 'subnet', label: '子网掩码与 CIDR 该怎么算？' },
];

export function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState('');
  const [stickSignal, setStickSignal] = useState(0);
  const outboxHandled = useRef<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
  });

  const chat = useChatSession(sessionId ?? null, user?.username ?? '我');
  const uploads = useUploads(sessionId ?? null);
  const phase = useChatStore((state) => state.runtime?.phase ?? 'idle');
  const handleSend = async (text: string, fileIds: string[], previewUrls: string[]) => {
    setStickSignal((value) => value + 1);
    return chat.send(text, fileIds, previewUrls);
  };
  const addFilesRef = useRef(uploads.addFiles);
  addFilesRef.current = uploads.addFiles;
  const pendingSendRef = useRef<{ text: string } | null>(null);

  useEffect(() => {
    pendingSendRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || chat.loading || outboxHandled.current === sessionId) {
      return;
    }
    if (!useChatStore.getState().runtime) {
      return;
    }
    const outbox = takeOutbox();
    if (!outbox) {
      return;
    }
    outboxHandled.current = sessionId;
    if (outbox.files.length > 0) {
      addFilesRef.current(outbox.files);
      setDraft(outbox.text);
      if (outbox.autoSend) {
        pendingSendRef.current = { text: outbox.text };
      }
      return;
    }
    if (outbox.text) {
      setDraft(outbox.text);
      if (outbox.autoSend) {
        void chat.send(outbox.text, []);
        setDraft('');
      }
    }
  }, [chat, sessionId]);

  useEffect(() => {
    const pending = pendingSendRef.current;
    if (!pending || !sessionId || chat.loading) {
      return;
    }
    if (uploads.items.some((item) => item.status === 'error')) {
      pendingSendRef.current = null;
      return;
    }
    if (uploads.items.length === 0 || !uploads.canSend) {
      return;
    }
    pendingSendRef.current = null;
    setStickSignal((value) => value + 1);
    void chat.send(
      pending.text,
      uploads.readyIds,
      uploads.items.map((item) => item.previewUrl),
    );
    setDraft('');
    uploads.detach();
  }, [chat, sessionId, uploads]);

  const handleNewChatSubmit = async (text: string, files: File[]): Promise<boolean> => {
    if (!text.trim() && files.length === 0) {
      return false;
    }
    const created = await createSession();
    if (!created) {
      return false;
    }
    setOutbox({ text: text.trim(), files, autoSend: true });
    navigate(`/chat/${created.id}`);
    return true;
  };

  const notFound = sessionQuery.error instanceof ApiError && sessionQuery.error.status === 404;

  if (sessionId && notFound) {
    return (
      <Result
        status="404"
        title="会话不存在"
        subTitle="它可能已被删除，或不属于当前账号。"
        extra={
          <Button type="primary" onClick={() => navigate('/chat')}>
            返回对话
          </Button>
        }
      />
    );
  }

  if (sessionId && chat.loadError) {
    return (
      <ErrorState
        title="对话加载失败"
        message={chat.loadError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const actions = {
    stop: () => void chat.stop(),
    retry: () => void chat.retry(),
    resend: (messageId: string, text: string) => void chat.resend(messageId, text),
    resync: chat.resync,
  };

  return (
    <ChatActionsProvider value={actions}>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-surface">
        <div className="flex min-h-0 w-full max-w-[1080px] flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            {sessionId && chat.loading ? (
              <PageLoading text="正在加载对话" />
            ) : chat.messages.length === 0 ? (
              <EmptyChat onPick={setDraft} />
            ) : (
              <MessageList
                messages={chat.messages}
                hasMore={chat.hasMore}
                loadingOlder={chat.loadingOlder}
                stickSignal={stickSignal}
                onLoadOlder={chat.loadOlder}
              />
            )}
          </div>

          <div className="shrink-0">
            {sessionId ? (
              <ChatComposer
                value={draft}
                onChange={setDraft}
                onSubmit={handleSend}
                uploads={uploads}
                phase={phase}
                onStop={actions.stop}
                disabled={chat.loading}
              />
            ) : (
              <PendingComposer
                draft={draft}
                onDraftChange={setDraft}
                onSubmit={handleNewChatSubmit}
              />
            )}
          </div>
        </div>
      </div>
    </ChatActionsProvider>
  );
}

function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-10 lg:px-8 lg:py-16">
      <span className="inline-flex size-7 items-center justify-center self-start rounded-chip bg-brand font-code text-[11px] tracking-[0.5px] text-white">
        CN
      </span>
      <h2 className="mt-5 text-[18px] font-semibold text-ink">从一句话开始</h2>
      <p className="mt-2 max-w-[38ch] text-[13px] leading-6 text-ink-muted">
        不用先组织好。把你现在理解到的部分说出来，老师会从那里接着问。
      </p>
      <div className="mt-6 w-full max-w-[560px] border-t border-line">
        {PROMPTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(item.label)}
            className="group flex w-full items-center gap-3 border-b border-line py-3 text-left transition-colors hover:bg-surface-sunken/70"
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full border border-line-strong transition-colors group-hover:border-brand group-hover:bg-brand"
            />
            <span className="min-w-0 flex-1 text-[13px] text-ink-muted group-hover:text-ink">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface StagedFile {
  uid: string;
  file: File;
  previewUrl: string;
}

function PendingComposer({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string, files: File[]) => Promise<boolean>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const filesRef = useRef<StagedFile[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        window.setTimeout(() => URL.revokeObjectURL(item.previewUrl), 10 * 60 * 1000);
      });
    };
  }, []);

  const addFiles = (incoming: File[]) => {
    const { accepted, rejection } = selectFiles(incoming, files.length);
    setFileError(rejection);
    if (accepted.length === 0) {
      return;
    }
    setFiles((current) => [
      ...current,
      ...accepted.map((file) => ({
        uid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeFile = (uid: string) => {
    setFileError(null);
    setFiles((current) => {
      const target = current.find((item) => item.uid === uid);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.uid !== uid);
    });
  };

  const canSubmit = !submitting && (draft.trim().length > 0 || files.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    await onSubmit(
      draft,
      files.map((item) => item.file),
    );
    setSubmitting(false);
  };

  const attachments = files.map((item) => ({
    uid: item.uid,
    previewUrl: item.previewUrl,
    status: 'ready' as const,
  }));

  return (
    <div className="shrink-0 bg-surface px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] lg:px-8">
      <div className="w-full">
        <p className="mb-2 text-[11.5px] text-ink-subtle">发送后会创建新会话</p>
        <ComposerCard
          value={draft}
          onChange={onDraftChange}
          onSubmit={() => void handleSubmit()}
          canSubmit={canSubmit}
          submitting={submitting}
          onPickFiles={addFiles}
          attachments={
            <AttachmentThumbs items={attachments} disabled={submitting} onRemove={removeFile} />
          }
          notice={
            fileError ? <p className="px-3.5 pt-2 text-[11.5px] text-danger">{fileError}</p> : null
          }
        />
      </div>
    </div>
  );
}
