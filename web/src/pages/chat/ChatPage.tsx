import { useQuery } from '@tanstack/react-query';
import { Button, Segmented } from 'antd';
import {
  ClipboardPaste,
  BookOpen,
  ExternalLink,
  ImagePlus,
  ListChecks,
  MessageCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { createSession, getSession } from '@/api/sessions';
import type { AgentKind } from '@/api/types';
import { ErrorState, PageLoading, StatePage } from '@/components/common';
import { ChatActionsProvider } from '@/features/chat/chat-actions';
import { ChatComposer } from '@/features/chat/ChatComposer';
import { ComposerCard } from '@/features/chat/ComposerCard';
import { MessageList } from '@/features/chat/MessageList';
import { setOutbox, takeOutbox } from '@/features/chat/outbox';
import { useChatSession } from '@/features/chat/use-chat-session';
import { KnowledgePicker } from '@/features/knowledge';
import { AttachmentThumbs } from '@/features/upload/AttachmentThumbs';
import { selectFiles } from '@/features/upload/file-rules';
import { useUploads } from '@/features/upload/use-uploads';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';

type StudyMode = Extract<AgentKind, 'teach_agent' | 'exam_agent'>;

const STUDY_MODES = [
  { label: '课程学习', value: 'teach_agent' },
  { label: '考研备考', value: 'exam_agent' },
] satisfies { label: string; value: StudyMode }[];

const MAX_PROMPT_LENGTH = 20000;

const MODE_PARAM_MAP: Record<string, StudyMode> = {
  course: 'teach_agent',
  exam: 'exam_agent',
};

interface Prefill {
  key: string;
  mode: StudyMode | null;
  prompt: string;
}

function readPrefill(params: URLSearchParams): Prefill {
  const rawMode = params.get('mode');
  const rawPrompt = params.get('prompt');
  const mode = rawMode ? (MODE_PARAM_MAP[rawMode] ?? null) : null;
  const prompt = rawPrompt ? rawPrompt.slice(0, MAX_PROMPT_LENGTH) : '';
  const key = rawMode || rawPrompt ? `${rawMode ?? ''}\u0000${rawPrompt ?? ''}` : '';
  return { key, mode, prompt };
}

export function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const initialPrefill = readPrefill(searchParams);
  const [draft, setDraft] = useState(initialPrefill.prompt);
  const [stickSignal, setStickSignal] = useState(0);
  const [knowledgeIds, setKnowledgeIds] = useState<string[] | null>(null);
  const [mode, setMode] = useState<StudyMode>(initialPrefill.mode ?? 'teach_agent');
  const appliedPrefill = useRef(initialPrefill.key);
  const outboxHandled = useRef<string | null>(null);

  useEffect(() => {
    const prefill = readPrefill(searchParams);
    if (!prefill.key) {
      appliedPrefill.current = '';
      return;
    }
    if (appliedPrefill.current === prefill.key) {
      return;
    }
    appliedPrefill.current = prefill.key;
    if (prefill.mode && !sessionId) {
      setMode(prefill.mode);
    }
    if (prefill.prompt) {
      setDraft(prefill.prompt);
    }
  }, [searchParams, sessionId]);

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
    const created = await createSession({
      knowledgeBaseIds: knowledgeIds ?? undefined,
      agentKind: mode,
    });
    if (!created) {
      return false;
    }
    setOutbox({ text: text.trim(), files, autoSend: true });
    navigate(`/chat/${created.id}`);
    return true;
  };

  const sessionKind = sessionQuery.data?.agent_kind;
  const startMode: StudyMode =
    sessionKind === 'exam_agent'
      ? 'exam_agent'
      : sessionKind === 'teach_agent'
        ? 'teach_agent'
        : mode;

  const notFound = sessionQuery.error instanceof ApiError && sessionQuery.error.status === 404;

  if (sessionId && notFound) {
    return (
      <StatePage
        code="404 · SESSION"
        title="会话不存在"
        description="它可能已被删除，或不属于当前账号。"
        action={
          <Button type="primary" onClick={() => navigate('/chat')}>
            返回对话
          </Button>
        }
      />
    );
  }

  if (sessionId && chat.loadError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[560px]">
          <ErrorState
            title="对话加载失败"
            message={chat.loadError}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
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
              <EmptyChat mode={startMode} locked={Boolean(sessionId)} onModeChange={setMode} />
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
                knowledgeBaseIds={sessionQuery.data?.knowledge_base_ids}
                disabled={chat.loading}
              />
            ) : (
              <PendingComposer
                draft={draft}
                onDraftChange={setDraft}
                onSubmit={handleNewChatSubmit}
                knowledgePicker={
                  <KnowledgePicker value={knowledgeIds} onChange={setKnowledgeIds} />
                }
              />
            )}
          </div>
        </div>
      </div>
    </ChatActionsProvider>
  );
}

const COURSE_STEPS = [
  {
    icon: MessageCircle,
    title: '直接提问',
    description: '把概念、公式或卡住的地方直接发到输入框。',
  },
  {
    icon: BookOpen,
    title: '按节阅读',
    description: '从「课程内容」打开教材目录，带着当前小节进入对话。',
  },
  {
    icon: ListChecks,
    title: '随堂检查',
    description: '讲完一个知识点后，让老师出一道题确认理解。',
  },
];

const EXAM_STEPS = [
  {
    icon: ImagePlus,
    title: '上传题目',
    description: '拍照或截图，从输入框左下角添加。',
  },
  {
    icon: ClipboardPaste,
    title: '粘贴题干',
    description: '也可以直接把题目文字粘贴进来。',
  },
  {
    icon: MessageCircle,
    title: '开始讲评',
    description: '先做题，再围绕错因继续追问。',
  },
];

function StepCards({ steps }: { steps: typeof COURSE_STEPS | typeof EXAM_STEPS }) {
  return (
    <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-md bg-brand-soft text-brand">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="font-code text-[10px] text-ink-subtle">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-4 mb-0 text-[13.5px] font-medium text-ink">{step.title}</h3>
            <p className="mt-1.5 mb-0 text-[12px] leading-5 text-ink-muted">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChat({
  mode,
  locked,
  onModeChange,
}: {
  mode: StudyMode;
  locked: boolean;
  onModeChange: (mode: StudyMode) => void;
}) {
  const courseMode = mode === 'teach_agent';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="min-w-0">
            <p className="m-0 eyebrow">{courseMode ? 'COURSE MAP' : 'EXAM PRACTICE'}</p>
            <h2 className="mt-1.5 mb-0 text-[21px] leading-tight font-semibold tracking-[-0.012em] text-ink">
              {courseMode ? '直接开始学习' : '上传一道题开始讲评'}
            </h2>
          </div>
          <div className="mt-1 flex shrink-0 flex-wrap items-center gap-2">
            {locked ? (
              <span className="rounded-chip bg-surface-sunken px-2.5 py-1 text-[12px] font-medium text-ink-muted">
                {courseMode ? '课程学习' : '考研备考'}
              </span>
            ) : (
              <Segmented
                value={mode}
                onChange={(value) => onModeChange(value as StudyMode)}
                options={STUDY_MODES}
              />
            )}
            <Button
              href="/learn"
              target="_blank"
              rel="noopener noreferrer"
              icon={<ExternalLink className="size-3.5" aria-hidden="true" />}
            >
              课程内容
            </Button>
          </div>
        </header>

        <StepCards steps={courseMode ? COURSE_STEPS : EXAM_STEPS} />
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
  knowledgePicker,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string, files: File[]) => Promise<boolean>;
  knowledgePicker?: ReactNode;
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
        <ComposerCard
          value={draft}
          onChange={onDraftChange}
          onSubmit={() => void handleSubmit()}
          canSubmit={canSubmit}
          submitting={submitting}
          onPickFiles={addFiles}
          leading={knowledgePicker}
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
