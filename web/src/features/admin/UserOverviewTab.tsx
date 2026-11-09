import { useQuery } from '@tanstack/react-query';
import { Segmented, Skeleton } from 'antd';
import { useState } from 'react';

import { getUserStats } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import { ErrorState, MetricCard } from '@/components/common';
import { DailyTrendChart } from '@/features/stats/charts';
import { formatNumber } from '@/lib/format';

const RANGES = [7, 30, 90];

export function UserOverviewTab({ userId }: { userId: string }) {
  const [days, setDays] = useState(30);

  const statsQuery = useQuery({
    queryKey: ['admin-user-stats', userId, days],
    queryFn: () => getUserStats(userId, days),
  });

  const data = statsQuery.data;

  return (
    <div>
      <div className="mb-4">
        <Segmented
          value={days}
          onChange={(value) => setDays(Number(value))}
          options={RANGES.map((range) => ({ label: `${range} 天`, value: range }))}
        />
      </div>

      {statsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : statsQuery.isError ? (
        <ErrorState
          title="学生统计加载失败"
          message={toErrorMessage(statsQuery.error, '统计服务暂不可用')}
          onRetry={() => void statsQuery.refetch()}
          compact
        />
      ) : !data ? null : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 min-[1200px]:grid-cols-4">
            <MetricCard label="总 tokens" value={formatNumber(data.totals.tokens)} />
            <MetricCard label="会话数" value={formatNumber(data.totals.sessions)} />
            <MetricCard label="对话轮次" value={formatNumber(data.totals.rounds)} />
            <MetricCard label="作答数" value={formatNumber(data.totals.answers)} />
          </div>

          <section className="min-w-0 rounded-card border border-line bg-surface p-4 max-[767px]:p-3">
            <h2 className="mb-3 text-[15px] font-semibold leading-normal tracking-[-0.01em]">每日趋势</h2>
            <DailyTrendChart data={data.daily} />
          </section>
        </>
      )}
    </div>
  );
}
