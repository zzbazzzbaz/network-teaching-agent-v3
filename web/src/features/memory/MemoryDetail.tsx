import { useQuery } from '@tanstack/react-query';
import { Alert, Drawer, Skeleton, Tag, Typography } from 'antd';

import { toErrorMessage } from '@/api/client';
import { getMemoryEntry } from '@/api/memory';
import { ErrorState } from '@/components/common';
import { Markdown } from '@/features/chat/markdown';
import { formatDateTime } from '@/lib/format';

import styles from './MemoryDetail.module.css';

export interface MemoryDetailProps {
  entryId: string | null;
  onClose: () => void;
}

export function MemoryDetail({ entryId, onClose }: MemoryDetailProps) {
  const detailQuery = useQuery({
    queryKey: ['memory-entry', entryId],
    queryFn: () => getMemoryEntry(entryId as string),
    enabled: Boolean(entryId),
    retry: false,
  });

  return (
    <Drawer open={Boolean(entryId)} width={560} title="记忆详情" onClose={onClose} destroyOnHidden>
      {detailQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : detailQuery.isError ? (
        <ErrorState
          title="记忆详情加载失败"
          message={toErrorMessage(detailQuery.error, '请稍后重试')}
          onRetry={() => void detailQuery.refetch()}
          compact
        />
      ) : detailQuery.data ? (
        <div className={styles.detail}>
          <Typography.Title level={4} className={styles.title}>
            {detailQuery.data.title}
          </Typography.Title>
          <div className={styles.meta}>
            <Tag>{detailQuery.data.kind === 'daily' ? '日常' : '摘要'}</Tag>
            <span className="data-text">
              {detailQuery.data.date ?? formatDateTime(detailQuery.data.updated_at)}
            </span>
            {detailQuery.data.session_title ? (
              <span className={styles.session}>{detailQuery.data.session_title}</span>
            ) : null}
          </div>
          {detailQuery.data.content_truncated ? (
            <Alert type="warning" showIcon message="内容较长，这里只展示了一部分" />
          ) : null}
          <Markdown content={detailQuery.data.content} className={styles.content} />
        </div>
      ) : null}
    </Drawer>
  );
}
