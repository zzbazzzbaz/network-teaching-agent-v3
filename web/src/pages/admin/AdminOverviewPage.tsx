import { useQuery } from '@tanstack/react-query';
import { Segmented, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useSearchParams } from 'react-router';

import { getOverview, getUserRanking, type AdminRankingSort } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { AdminUserRankingItem } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { MetricCard } from '@/features/admin';
import { DailyTrendChart } from '@/features/stats/charts';
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format';

const RANGES = [7, 30, 90];
const SORTS: Array<{ label: string; value: AdminRankingSort }> = [
  { label: '按 tokens', value: 'tokens' },
  { label: '按轮次', value: 'rounds' },
  { label: '按作答', value: 'answers' },
  { label: '按会话', value: 'sessions' },
];

function parseSort(value: string | null): AdminRankingSort {
  return SORTS.some((item) => item.value === value) ? (value as AdminRankingSort) : 'tokens';
}

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const daysParam = Number(searchParams.get('days') ?? '30');
  const days = RANGES.includes(daysParam) ? daysParam : 30;
  const sort = parseSort(searchParams.get('sort'));

  const overviewQuery = useQuery({
    queryKey: ['admin-overview', days],
    queryFn: () => getOverview(days),
  });
  const rankingQuery = useQuery({
    queryKey: ['admin-ranking', days, sort],
    queryFn: () => getUserRanking(days, sort, 20),
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const columns: ColumnsType<AdminUserRankingItem> = [
    {
      title: '学生',
      dataIndex: 'username',
      render: (username: string, record) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm text-brand hover:text-brand-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => navigate(`/admin/users/${record.user_id}`)}
        >
          {username}
        </button>
      ),
    },
    {
      title: 'tokens',
      dataIndex: 'tokens',
      width: 130,
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
      title: '作答',
      dataIndex: 'answers',
      width: 90,
      align: 'right',
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '会话',
      dataIndex: 'sessions',
      width: 90,
      align: 'right',
      responsive: ['lg'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '最近活跃',
      dataIndex: 'last_active_at',
      width: 170,
      responsive: ['xl'],
      render: (value: string | null) => <span className="data-text">{formatDateTime(value)}</span>,
    },
  ];

  const data = overviewQuery.data;

  return (
    <PageShell>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={days}
          onChange={(value) => updateParam('days', String(value))}
          options={RANGES.map((range) => ({ label: `${range} 天`, value: range }))}
        />
      </header>

      {overviewQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : overviewQuery.isError ? (
        <ErrorState
          title="总体统计加载失败"
          message={toErrorMessage(overviewQuery.error, '统计服务暂不可用')}
          onRetry={() => void overviewQuery.refetch()}
          compact
        />
      ) : !data ? (
        <EmptyState title="暂无统计数据" description="当前时间范围内没有记录。" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 min-[1200px]:grid-cols-4">
            <MetricCard label="学生总数" value={formatNumber(data.students_total)} />
            <MetricCard
              label="活跃学生"
              value={formatNumber(data.students_active)}
              tooltip="所选时间范围内至少产生过 1 个对话轮次的学生数（去重），不含管理员。登录、查看记忆等行为不计入。"
            />
            <MetricCard
              label="新增学生"
              value={formatNumber(data.students_new)}
              tooltip="所选时间范围内新注册的学生数，按账号注册时间统计，不含管理员。"
            />
            <MetricCard label="活跃会话" value={formatNumber(data.sessions)} />
            <MetricCard label="对话轮次" value={formatNumber(data.rounds)} />
            <MetricCard label="作答数" value={formatNumber(data.answers)} />
            <MetricCard label="tokens" value={formatNumber(data.tokens)} />
            <MetricCard label="缓存命中率" value={formatPercent(data.cache_hit_rate)} />
          </div>

          <section className="min-w-0 rounded-card border border-line bg-surface p-4 max-[767px]:p-3">
            <h2 className="mb-3 text-[15px] font-semibold leading-normal tracking-[-0.01em]">每日趋势</h2>
            <DailyTrendChart data={data.daily} showActiveStudents />
          </section>

          <section className="mt-4 rounded-card border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="m-0 text-[15px] font-semibold leading-normal tracking-[-0.01em]">学生排行</h2>
              <Segmented
                size="small"
                value={sort}
                onChange={(value) => updateParam('sort', String(value))}
                options={SORTS}
              />
            </header>
            {rankingQuery.isLoading ? (
              <div className="p-4">
                <Skeleton active paragraph={{ rows: 4 }} />
              </div>
            ) : rankingQuery.isError ? (
              <ErrorState
                title="学生排行加载失败"
                message={toErrorMessage(rankingQuery.error, '请稍后重试')}
                onRetry={() => void rankingQuery.refetch()}
                compact
              />
            ) : (rankingQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState title="暂无排行数据" description="当前时间范围内没有学生活动。" />
            ) : (
              <Table
                rowKey="user_id"
                size="middle"
                columns={columns}
                dataSource={rankingQuery.data?.items ?? []}
                pagination={false}
              />
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
