import { ArrowUpOutlined, PictureOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Input, Upload } from 'antd';
import type { KeyboardEvent, ReactNode } from 'react';

import { ACCEPTED_IMAGE_TYPES } from '@/features/upload/file-rules';
import { UPLOAD_MAX_COUNT } from '@/lib/config';

export interface ComposerCardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  attachments?: ReactNode;
  notice?: ReactNode;
  leading?: ReactNode;
  onPickFiles: (files: File[]) => void;
  disabled?: boolean;
  submitting?: boolean;
  running?: boolean;
  onStop?: () => void;
}

export function ComposerCard({
  value,
  onChange,
  onSubmit,
  canSubmit,
  attachments,
  notice,
  leading,
  onPickFiles,
  disabled = false,
  submitting = false,
  running = false,
  onStop,
}: ComposerCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (canSubmit) {
      onSubmit();
    }
  };

  return (
    <div className="rounded-card border border-line-strong bg-surface transition-colors focus-within:border-brand">
      {attachments}
      {notice}
      <Input.TextArea
        variant="borderless"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        autoSize={{ minRows: 1, maxRows: 8 }}
        aria-label="输入问题"
        className="resize-none px-3.5 pt-3 pb-1 text-[15px] leading-6 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-1 px-2 pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <Upload
            multiple
            maxCount={UPLOAD_MAX_COUNT}
            accept={ACCEPTED_IMAGE_TYPES}
            showUploadList={false}
            disabled={disabled}
            beforeUpload={(file) => {
              onPickFiles([file as unknown as File]);
              return Upload.LIST_IGNORE;
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<PictureOutlined />}
              aria-label="添加图片"
              title="添加图片"
              disabled={disabled}
            />
          </Upload>
          {leading}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {running && onStop ? (
            <Button
              type="primary"
              shape="circle"
              className="size-8 min-w-8"
              icon={<StopOutlined />}
              aria-label="停止生成"
              title="停止生成"
              onClick={onStop}
            />
          ) : (
            <Button
              type="primary"
              shape="circle"
              className="size-8 min-w-8"
              icon={<ArrowUpOutlined />}
              aria-label="发送消息"
              disabled={!canSubmit}
              loading={submitting}
              onClick={onSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
