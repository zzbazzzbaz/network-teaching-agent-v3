import { useQuery } from '@tanstack/react-query';
import { Card, Collapse, Segmented, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useSearchParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { getMyStats } from '@/api/stats';
import type { DailyStatsItem } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { DailyTrendChart } from '@/features/stats/charts';
import { formatNumber, formatPercent } from '@/lib/format';

const RANGES = [7, 30, 90];

export function StatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const daysParam = Number(searchParams.get('days') ?? '30');
  const days = RANGES.includes(daysParam) ? daysParam : 30;

  const statsQuery = useQuery({
    queryKey: ['stats', days],
    queryFn: () => getMyStats(days),
  });

  const updateDays = (value: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('days', String(value));
    setSearchParams(next, { replace: true });
  };

  const columns: ColumnsType<DailyStatsItem> = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
      render: (value: string) => <span className="data-text">{value}</span>,
    },
    {
      title: '输入 tokens',
      dataIndex: 'input_tokens',
      width: 120,
      align: 'right',
      responsive: ['xl'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '输出 tokens',
      dataIndex: 'output_tokens',
      width: 120,
      align: 'right',
      responsive: ['xl'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '缓存 tokens',
      dataIndex: 'cache_input_tokens',
      width: 120,
      align: 'right',
      responsive: ['xl'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '总 tokens',
      dataIndex: 'tokens',
      width: 110,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '轮次',
      dataIndex: 'rounds',
      width: 80,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '缓存命中率',
      dataIndex: 'cache_hit_rate',
      width: 120,
      align: 'right',
      responsive: ['lg'],
      render: (value: number | null) => <span className="data-text">{formatPercent(value)}</span>,
    },
  ];

  const data = statsQuery.data;

  return (
    <PageShell>
      <header className="mb-5 flex flex-wrap items-start gap-4">
        <Segmented
          value={days}
          onChange={(value) => updateDays(Number(value))}
          options={RANGES.map((range) => ({ label: `${range} 天`, value: range }))}
        />
      </header>

      {statsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : statsQuery.isError ? (
        <ErrorState
          title="统计加载失败"
          message={toErrorMessage(statsQuery.error, '统计服务暂不可用')}
          onRetry={() => void statsQuery.refetch()}
          compact
        />
      ) : !data ? (
        <EmptyState
          title="暂无用量数据"
          description="完成一次对话后，这里会出现 token 与轮次记录。"
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 min-[1200px]:grid-cols-4">
            <Card className="border border-line" size="small">
              <div className="mb-1.5 text-[13px] text-ink-muted">总 tokens</div>
              <div className="font-code text-2xl leading-tight tabular-nums max-[767px]:text-xl">
                {formatNumber(data.totals.tokens)}
              </div>
            </Card>
            <Card className="border border-line" size="small">
              <div className="mb-1.5 text-[13px] text-ink-muted">会话数</div>
              <div className="font-code text-2xl leading-tight tabular-nums max-[767px]:text-xl">
                {formatNumber(data.totals.sessions)}
              </div>
            </Card>
            <Card className="border border-line" size="small">
              <div className="mb-1.5 text-[13px] text-ink-muted">对话轮次</div>
              <div className="font-code text-2xl leading-tight tabular-nums max-[767px]:text-xl">
                {formatNumber(data.totals.rounds)}
              </div>
            </Card>
            <Card className="border border-line" size="small">
              <div className="mb-1.5 text-[13px] text-ink-muted">作答数</div>
              <div className="font-code text-2xl leading-tight tabular-nums max-[767px]:text-xl">
                {formatNumber(data.totals.answers)}
              </div>
            </Card>
          </div>

          {data.daily.length === 0 ? (
            <EmptyState
              title="暂无用量数据"
              description="当前时间范围内没有记录，换一个范围看看。"
            />
          ) : (
            <>
              <section className="min-w-0 rounded-card border border-line bg-surface p-4 max-[767px]:p-3">
                <h2 className="mb-3 text-base font-semibold leading-normal">每日趋势</h2>
                <DailyTrendChart data={data.daily} />
              </section>

              <section className="mt-4 rounded-card border border-line bg-surface px-4 py-1 max-[767px]:px-3">
                <Collapse
                  ghost
                  expandIconPlacement="end"
                  classNames={{
                    header: 'rounded-chip transition-colors hover:bg-surface-sunken/70',
                  }}
                  styles={{ header: { padding: '12px 0' }, body: { padding: '0 0 16px' } }}
                  items={[
                    {
                      key: 'detail',
                      label: (
                        <span className="text-base font-semibold leading-normal">每日明细</span>
                      ),
                      children: (
                        <Table
                          rowKey="date"
                          size="middle"
                          columns={columns}
                          dataSource={data.daily}
                          pagination={false}
                        />
                      ),
                    },
                  ]}
                />
              </section>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
