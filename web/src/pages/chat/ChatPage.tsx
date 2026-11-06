import { PlusOutlined } from '@ant-design/icons';
import { Attachments, Prompts, Sender, Welcome } from '@ant-design/x';
import { useQuery } from '@tanstack/react-query';
import { Button, Result, Typography, Upload } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { createSession, getSession } from '@/api/sessions';
import { ErrorState, PageLoading } from '@/components/common';
import { ChatActionsProvider } from '@/features/chat/chat-actions';
import { ChatComposer } from '@/features/chat/ChatComposer';
import { MessageList } from '@/features/chat/MessageList';
import { setOutbox, takeOutbox } from '@/features/chat/outbox';
import { useChatSession } from '@/features/chat/use-chat-session';
import { ACCEPTED_IMAGE_TYPES, selectFiles } from '@/features/upload/file-rules';
import { useUploads } from '@/features/upload/use-uploads';
import { UPLOAD_MAX_COUNT } from '@/lib/config';
import { useIsMobile } from '@/lib/use-media-query';
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
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
        <div className="flex min-h-0 w-full max-w-chat flex-col px-4 max-[767px]:px-3">
          <div className="flex min-h-0 flex-1 flex-col">
            {sessionId && chat.loading ? (
              <PageLoading text="正在加载对话" />
            ) : chat.messages.length === 0 ? (
              <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-12 pb-6 max-[767px]:pt-6 max-[767px]:pb-4">
                <Welcome
                  variant="borderless"
                  title="计算机网络 · 对话式学习"
                  description="问概念、拆协议、做题都可以。发送后会实时看到老师的推理与回答。"
                />
                <Prompts
                  vertical
                  title="可以从这里开始"
                  items={PROMPTS.map((item) => ({ key: item.key, label: item.label }))}
                  onItemClick={(info) => setDraft(String(info.data.label ?? ''))}
                />
              </div>
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
  const isMobile = useIsMobile();
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
    name: item.file.name,
    size: item.file.size,
    status: 'done' as const,
    url: item.previewUrl,
    thumbUrl: item.previewUrl,
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <Typography.Text type="secondary" className="text-xs">
        发送后会创建新会话
      </Typography.Text>
      <Sender
        value={draft}
        onChange={onDraftChange}
        onSubmit={() => void handleSubmit()}
        loading={submitting}
        placeholder={isMobile ? '向老师提问…' : '向老师提问，Enter 发送，Shift + Enter 换行'}
        autoSize={{ minRows: 1, maxRows: 8 }}
        aria-label="输入问题"
        header={
          files.length === 0 ? (
            <Attachments
              multiple
              maxCount={UPLOAD_MAX_COUNT}
              accept={ACCEPTED_IMAGE_TYPES}
              beforeUpload={(file) => {
                addFiles([file as unknown as File]);
                return Upload.LIST_IGNORE;
              }}
            >
              <Button size="small" type="text" icon={<PlusOutlined />}>
                添加图片
              </Button>
            </Attachments>
          ) : (
            <Attachments
              items={attachments}
              multiple
              maxCount={UPLOAD_MAX_COUNT}
              accept={ACCEPTED_IMAGE_TYPES}
              overflow="scrollX"
              beforeUpload={(file) => {
                addFiles([file as unknown as File]);
                return Upload.LIST_IGNORE;
              }}
              onRemove={(file) => {
                removeFile(file.uid);
                return true;
              }}
            />
          )
        }
      />
      {fileError ? (
        <Typography.Text type="danger" className="text-xs">
          {fileError}
        </Typography.Text>
      ) : null}
    </div>
  );
}
