import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DailyStatsItem } from '@/api/types';
import { formatNumber, formatPercent } from '@/lib/format';

import styles from './charts.module.css';

function useChartColors() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { brand: '#12586B', muted: '#8A94A1', line: '#E4E8ED' };
    }
    const computed = getComputedStyle(document.documentElement);
    return {
      brand: computed.getPropertyValue('--brand-600').trim() || '#12586B',
      muted: computed.getPropertyValue('--ink-400').trim() || '#8A94A1',
      line: computed.getPropertyValue('--line').trim() || '#E4E8ED',
    };
  }, []);
}

function axisProps() {
  return {
    tick: { fontSize: 11, fill: '#8A94A1' },
    axisLine: false,
    tickLine: false,
  } as const;
}

export function TokensTrendChart({ data }: { data: DailyStatsItem[] }) {
  const colors = useChartColors();
  return (
    <div className={styles.chart} role="img" aria-label="每日 token 与轮次趋势">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="tokensFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand} stopOpacity={0.22} />
              <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" {...axisProps()} />
          <YAxis
            {...axisProps()}
            width={52}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <Tooltip
            formatter={(value, name) => [
              formatNumber(Number(value)),
              name === 'tokens' ? 'tokens' : '轮次',
            ]}
            labelFormatter={(label) => String(label ?? '')}
            contentStyle={{ borderRadius: 8, border: `1px solid ${colors.line}`, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke={colors.brand}
            strokeWidth={2}
            fill="url(#tokensFill)"
            name="tokens"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CacheHitChart({ data }: { data: DailyStatsItem[] }) {
  const colors = useChartColors();
  return (
    <div className={styles.chart} role="img" aria-label="每日缓存命中率">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" {...axisProps()} />
          <YAxis
            {...axisProps()}
            width={52}
            domain={[0, 1]}
            tickFormatter={(value: number) => formatPercent(value)}
          />
          <Tooltip
            formatter={(value) => [
              formatPercent(value === undefined || value === null ? null : Number(value)),
              '命中率',
            ]}
            contentStyle={{ borderRadius: 8, border: `1px solid ${colors.line}`, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="cache_hit_rate"
            stroke={colors.muted}
            strokeWidth={2}
            dot={false}
            connectNulls
            name="cache_hit_rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RoundsTrendChart({ data }: { data: DailyStatsItem[] }) {
  const colors = useChartColors();
  return (
    <div className={styles.chart} role="img" aria-label="每日对话轮次">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" {...axisProps()} />
          <YAxis {...axisProps()} width={52} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value)), '轮次']}
            contentStyle={{ borderRadius: 8, border: `1px solid ${colors.line}`, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="rounds"
            stroke={colors.muted}
            strokeWidth={2}
            fill="none"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
