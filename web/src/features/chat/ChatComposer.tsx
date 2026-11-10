import { useState } from 'react';

import { KnowledgeBadge } from '@/features/knowledge';
import { AttachmentThumbs } from '@/features/upload/AttachmentThumbs';
import type { UseUploadsResult } from '@/features/upload/use-uploads';
import type { SessionPhase } from '@/lib/agentscope/project';

import { ComposerCard } from './ComposerCard';

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string, fileIds: string[], previewUrls: string[]) => Promise<boolean>;
  uploads: UseUploadsResult;
  phase: SessionPhase;
  onStop: () => void;
  knowledgeBaseIds?: string[];
  disabled?: boolean;
}

const TEXT_LIMIT = 20000;

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  uploads,
  phase,
  onStop,
  knowledgeBaseIds,
  disabled = false,
}: ChatComposerProps) {
  const [submitting, setSubmitting] = useState(false);
  const running = phase === 'running';
  const blocked = disabled || phase === 'reconnecting';

  const canSubmit =
    !blocked &&
    !running &&
    !submitting &&
    uploads.canSend &&
    (value.trim().length > 0 || uploads.readyIds.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    const previews = uploads.items
      .filter((item) => item.status === 'ready')
      .map((item) => item.previewUrl);
    const ok = await onSubmit(value, uploads.readyIds, previews);
    setSubmitting(false);
    if (ok) {
      onChange('');
      uploads.detach();
    }
  };

  return (
    <div className="shrink-0 bg-surface px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] lg:px-8">
      <div className="w-full">
        {phase === 'reconnecting' ? (
          <p className="mb-2 text-[11.5px] text-warning">正在恢复连接，暂不能发送</p>
        ) : null}
        <ComposerCard
          value={value}
          onChange={(next) => onChange(next.slice(0, TEXT_LIMIT))}
          onSubmit={() => void handleSubmit()}
          canSubmit={canSubmit}
          disabled={blocked}
          submitting={submitting}
          running={running}
          onStop={onStop}
          onPickFiles={uploads.addFiles}
          leading={knowledgeBaseIds ? <KnowledgeBadge ids={knowledgeBaseIds} /> : null}
          attachments={
            <AttachmentThumbs
              items={uploads.items.map((item) => ({
                uid: item.uid,
                previewUrl: item.previewUrl,
                status: item.status,
                percent: item.percent,
              }))}
              disabled={blocked}
              onRemove={uploads.removeItem}
              onRetry={uploads.retryItem}
            />
          }
          notice={
            uploads.error ? (
              <p className="px-3.5 pt-2 text-[11.5px] text-danger">{uploads.error}</p>
            ) : null
          }
        />
        <p className="px-1.5 pt-2 text-[11px] text-ink-subtle">
          图片会生成公开链接，请勿上传敏感信息。
        </p>
      </div>
    </div>
  );
}
