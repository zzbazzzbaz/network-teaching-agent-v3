import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  DatePicker,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { listMemoryEntries } from '@/api/memory';
import { listSessions } from '@/api/sessions';
import type { MemoryEntry } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { MemoryDetail } from '@/features/memory/MemoryDetail';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

export function MemoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = searchParams.get('tab') === 'digest' ? 'digest' : 'daily';
  const date = searchParams.get('date') ?? '';
  const sessionId = searchParams.get('session') ?? '';
  const page = Math.max(Number(searchParams.get('page') ?? '1'), 1);
  const entryId = searchParams.get('entry');

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'filter'],
    queryFn: () => listSessions({ limit: 100, offset: 0 }),
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ['memory', kind, date, sessionId, page],
    queryFn: () =>
      listMemoryEntries({
        kind,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        date: kind === 'daily' && date ? date : undefined,
        session_id: sessionId || undefined,
      }),
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    if (key === 'tab') {
      next.delete('date');
    }
    setSearchParams(next, { replace: true });
  };

  const columns: ColumnsType<MemoryEntry> = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (title: string, record) => (
        <button
          type="button"
          className="block max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-sm text-brand hover:text-brand-strong hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => updateParam('entry', record.id)}
        >
          {title}
        </button>
      ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      ellipsis: true,
      responsive: ['lg'],
      render: (summary: string) => (
        <Typography.Text type="secondary" className="text-[13px]">
          {summary || '--'}
        </Typography.Text>
      ),
    },
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
      render: (_value, record) => <span className="data-text">{record.date ?? '\u2014'}</span>,
    },
    {
      title: '会话',
      dataIndex: 'session_title',
      width: 160,
      ellipsis: true,
      responsive: ['xl'],
      render: (value: string | null) => (
        <Typography.Text type="secondary">{value ?? '\u2014'}</Typography.Text>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      responsive: ['lg'],
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
  ];

  const data = listQuery.data;

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[767px]:flex-col max-[767px]:items-stretch">
        <Segmented
          value={kind}
          onChange={(value) => updateParam('tab', String(value) === 'digest' ? 'digest' : null)}
          options={[
            { label: '日常', value: 'daily' },
            { label: '摘要', value: 'digest' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {kind === 'daily' ? (
            <DatePicker
              allowClear
              placeholder="按日期筛选"
              value={date ? dayjs(date) : null}
              onChange={(value) => updateParam('date', value ? value.format('YYYY-MM-DD') : null)}
            />
          ) : null}
          <Select
            allowClear
            placeholder="全部会话"
            style={{ minWidth: 200 }}
            value={sessionId || undefined}
            onChange={(value) => updateParam('session', value ?? null)}
            options={(sessionsQuery.data?.items ?? []).map((item) => ({
              label: item.title,
              value: item.id,
            }))}
          />
        </div>
      </div>

      {data?.truncated ? (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="记忆条目较多，当前列表只展示部分结果"
        />
      ) : null}

      {listQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : listQuery.isError ? (
        <ErrorState
          title="记忆加载失败"
          message={toErrorMessage(listQuery.error, '记忆服务暂不可用')}
          onRetry={() => void listQuery.refetch()}
          compact
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="还没有学习记忆"
          description="和老师完成一次对话后，这里会记录你当天学过什么。"
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <Table
              rowKey="id"
              columns={columns}
              dataSource={data.items}
              pagination={false}
              className="bg-surface"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              showSizeChanger={false}
              onChange={(nextPage) => updateParam('page', String(nextPage))}
            />
          </div>
        </>
      )}

      <MemoryDetail entryId={entryId} onClose={() => updateParam('entry', null)} />
    </PageShell>
  );
}
