import { useQuery } from '@tanstack/react-query';
import { Card, Segmented, Skeleton, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useSearchParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { getMyStats } from '@/api/stats';
import type { DailyStatsItem } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common';
import { CacheHitChart, RoundsTrendChart, TokensTrendChart } from '@/features/stats/charts';
import { formatNumber, formatPercent } from '@/lib/format';

import styles from './StatsPage.module.css';

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
      title: 'input',
      dataIndex: 'input_tokens',
      width: 110,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: 'output',
      dataIndex: 'output_tokens',
      width: 110,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: 'cache',
      dataIndex: 'cache_input_tokens',
      width: 110,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: 'tokens',
      dataIndex: 'tokens',
      width: 120,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '轮次',
      dataIndex: 'rounds',
      width: 90,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '命中率',
      dataIndex: 'cache_hit_rate',
      width: 110,
      align: 'right',
      render: (value: number | null) => <span className="data-text">{formatPercent(value)}</span>,
    },
  ];

  const data = statsQuery.data;

  return (
    <div className="page-shell">
      <header className={styles.header}>
        <div>
          <p className="page-subtitle">按 Asia/Shanghai 聚合的用量概览，只统计你自己的数据。</p>
        </div>
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
          <div className={styles.cards}>
            <Card className={styles.card} size="small">
              <div className={styles.cardLabel}>总 tokens</div>
              <div className={styles.cardValue}>{formatNumber(data.totals.tokens)}</div>
            </Card>
            <Card className={styles.card} size="small">
              <div className={styles.cardLabel}>会话数</div>
              <div className={styles.cardValue}>{formatNumber(data.totals.sessions)}</div>
            </Card>
            <Card className={styles.card} size="small">
              <div className={styles.cardLabel}>对话轮次</div>
              <div className={styles.cardValue}>{formatNumber(data.totals.rounds)}</div>
            </Card>
            <Card className={styles.card} size="small">
              <div className={styles.cardLabel}>作答数</div>
              <div className={styles.cardValue}>{formatNumber(data.totals.answers)}</div>
            </Card>
          </div>

          {data.daily.length === 0 ? (
            <EmptyState
              title="暂无用量数据"
              description="当前时间范围内没有记录，换一个范围看看。"
            />
          ) : (
            <>
              <div className={styles.panels}>
                <section className={styles.panel}>
                  <h2 className="section-title">每日 tokens</h2>
                  <TokensTrendChart data={data.daily} />
                </section>
                <section className={styles.panel}>
                  <h2 className="section-title">每日轮次</h2>
                  <RoundsTrendChart data={data.daily} />
                </section>
              </div>

              <section className={styles.panel}>
                <h2 className="section-title">缓存命中率</h2>
                <CacheHitChart data={data.daily} />
                <Typography.Text type="secondary" className={styles.hint}>
                  没有缓存数据时显示「--」，不代表 0%。
                </Typography.Text>
              </section>

              <section className={styles.panel}>
                <h2 className="section-title">明细</h2>
                <Table
                  rowKey="date"
                  size="middle"
                  columns={columns}
                  dataSource={data.daily}
                  pagination={false}
                  scroll={{ x: 820 }}
                />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
