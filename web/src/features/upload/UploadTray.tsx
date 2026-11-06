import { Attachments } from '@ant-design/x';
import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Upload } from 'antd';
import { useMemo } from 'react';

import { formatBytes } from '@/lib/format';

import type { UploadItem } from './use-uploads';
import styles from './UploadTray.module.css';

export interface UploadTrayProps {
  items: UploadItem[];
  error: string | null;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (uid: string) => void;
  onRetry: (uid: string) => void;
}

export function UploadTray({ items, error, disabled, onAdd, onRemove, onRetry }: UploadTrayProps) {
  const attachmentItems = useMemo(
    () =>
      items.map((item) => ({
        uid: item.uid,
        name: item.name,
        size: item.size,
        status:
          item.status === 'ready'
            ? ('done' as const)
            : item.status === 'error'
              ? ('error' as const)
              : ('uploading' as const),
        percent: item.percent,
        url: item.previewUrl,
        thumbUrl: item.previewUrl,
        description:
          item.status === 'error' ? (
            <span className={styles.errorRow}>
              <span>{item.error ?? '上传失败'}</span>
              <Button type="link" size="small" onClick={() => onRetry(item.uid)}>
                重试
              </Button>
            </span>
          ) : (
            <span className={styles.meta}>
              {item.status === 'ready' ? '已就绪' : `${item.percent}%`} · {formatBytes(item.size)}
            </span>
          ),
      })),
    [items, onRetry],
  );

  const sharedProps = {
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp',
    multiple: true,
    maxCount: 4,
    disabled,
    beforeUpload: (file: File) => {
      onAdd([file as unknown as File]);
      return Upload.LIST_IGNORE;
    },
    onRemove: (file: { uid: string }) => {
      onRemove(file.uid);
      return true;
    },
  };

  const failed = items.filter((item) => item.status === 'error');

  return (
    <div className={styles.root}>
      {items.length === 0 ? (
        <Attachments {...sharedProps}>
          <Button size="small" type="text" icon={<PlusOutlined />} disabled={disabled}>
            添加图片
          </Button>
        </Attachments>
      ) : (
        <Attachments {...sharedProps} items={attachmentItems} overflow="scrollX" />
      )}
      {failed.map((item) => (
        <div key={item.uid} className={styles.failRow}>
          <span>
            {item.name}：{item.error ?? '上传失败'}
          </span>
          <Button type="link" size="small" onClick={() => onRetry(item.uid)}>
            重试
          </Button>
        </div>
      ))}
      {error ? (
        <Alert className={styles.alert} type="warning" showIcon banner message={error} />
      ) : null}
    </div>
  );
}
