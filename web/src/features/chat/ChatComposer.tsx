import { Sender } from '@ant-design/x';
import { useState } from 'react';

import { UploadTray } from '@/features/upload/UploadTray';
import type { UseUploadsResult } from '@/features/upload/use-uploads';
import type { SessionPhase } from '@/lib/agentscope/project';

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string, fileIds: string[], previewUrls: string[]) => Promise<boolean>;
  uploads: UseUploadsResult;
  phase: SessionPhase;
  onStop: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const TEXT_LIMIT = 20000;

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  uploads,
  phase,
  onStop,
  disabled = false,
  placeholder = '向老师提问，Enter 发送，Shift + Enter 换行',
}: ChatComposerProps) {
  const [submitting, setSubmitting] = useState(false);
  const running = phase === 'running';
  const blocked = disabled || phase === 'reconnecting';

  const canSubmit =
    !blocked &&
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
    <div className="w-full border-t border-line bg-surface py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
      <Sender
        value={value}
        onChange={(next) => onChange(next.slice(0, TEXT_LIMIT))}
        onSubmit={() => {
          void handleSubmit();
        }}
        loading={running}
        onCancel={onStop}
        disabled={blocked}
        placeholder={placeholder}
        autoSize={{ minRows: 1, maxRows: 8 }}
        aria-label="输入问题"
        header={
          <UploadTray
            items={uploads.items}
            error={uploads.error}
            onAdd={uploads.addFiles}
            onRemove={uploads.removeItem}
            onRetry={uploads.retryItem}
            disabled={blocked}
          />
        }
      />
      <div className="flex items-center justify-between gap-3 px-1 pt-1.5 text-xs text-ink-subtle">
        <span className="data-text">
          {value.trim().length} / {TEXT_LIMIT}
        </span>
        {phase === 'reconnecting' ? (
          <span className="text-warning">正在恢复连接，暂不能发送</span>
        ) : null}
      </div>
    </div>
  );
}
