import { useQuery } from '@tanstack/react-query';
import { Alert, Drawer, Skeleton, Tag } from 'antd';

import { toErrorMessage } from '@/api/client';
import { getMemoryEntry } from '@/api/memory';
import type { MemoryEntryDetail } from '@/api/types';
import { ErrorState } from '@/components/common';
import { Markdown } from '@/features/chat/markdown';
import { formatDate, formatDateTime } from '@/lib/format';

export interface MemoryDetailProps {
  entryId: string | null;
  onClose: () => void;
  fetchEntry?: (entryId: string) => Promise<MemoryEntryDetail>;
  queryKeyPrefix?: string;
}

export function MemoryDetail({
  entryId,
  onClose,
  fetchEntry,
  queryKeyPrefix = 'self',
}: MemoryDetailProps) {
  const detailQuery = useQuery({
    queryKey: ['memory-entry', queryKeyPrefix, entryId],
    queryFn: () => (fetchEntry ?? getMemoryEntry)(entryId as string),
    enabled: Boolean(entryId),
    retry: false,
  });

  return (
    <Drawer open={Boolean(entryId)} size={560} title="记忆详情" onClose={onClose} destroyOnHidden>
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
        <div className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold">{detailQuery.data.title}</h2>
          <div className="flex items-center gap-2.5 text-[13px] text-ink-muted">
            <Tag>{detailQuery.data.kind === 'daily' ? '日常' : '摘要'}</Tag>
            <span className="data-text">
              {detailQuery.data.date
                ? formatDate(detailQuery.data.date)
                : formatDateTime(detailQuery.data.updated_at)}
            </span>
            {detailQuery.data.session_title ? (
              <span className="text-[13px] text-ink-muted">{detailQuery.data.session_title}</span>
            ) : null}
          </div>
          {detailQuery.data.content_truncated ? (
            <Alert type="warning" showIcon message="内容较长，这里只展示了一部分" />
          ) : null}
          <Markdown content={detailQuery.data.content} className="text-[15px] leading-[1.8]" />
        </div>
      ) : null}
    </Drawer>
  );
}
