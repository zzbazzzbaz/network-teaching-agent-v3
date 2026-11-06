import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
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
      return {
        tokens: '#12586B',
        rounds: '#9A6A16',
        rate: '#1E7A52',
        muted: '#8A94A1',
        line: '#E4E8ED',
      };
    }
    const computed = getComputedStyle(document.documentElement);
    return {
      tokens: computed.getPropertyValue('--brand-600').trim() || '#12586B',
      rounds: computed.getPropertyValue('--warning').trim() || '#9A6A16',
      rate: computed.getPropertyValue('--success').trim() || '#1E7A52',
      muted: computed.getPropertyValue('--ink-400').trim() || '#8A94A1',
      line: computed.getPropertyValue('--line').trim() || '#E4E8ED',
    };
  }, []);
}

const AXIS_PROPS = {
  tick: { fontSize: 11, fill: '#8A94A1' },
  axisLine: false,
  tickLine: false,
} as const;

const TOOLTIP_ORDER: Record<string, number> = {
  tokens: 0,
  轮次: 1,
  缓存命中率: 2,
};

export function DailyTrendChart({ data }: { data: DailyStatsItem[] }) {
  const colors = useChartColors();

  return (
    <div className={styles.chart} role="img" aria-label="每日 tokens、轮次与缓存命中率趋势">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" {...AXIS_PROPS} />
          <YAxis
            yAxisId="tokens"
            orientation="left"
            {...AXIS_PROPS}
            width={64}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <YAxis
            yAxisId="rounds"
            orientation="right"
            {...AXIS_PROPS}
            width={44}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            {...AXIS_PROPS}
            width={60}
            domain={[0, 1]}
            tickFormatter={(value: number) => formatPercent(value)}
          />
          <Tooltip
            itemSorter={(item) => TOOLTIP_ORDER[String(item.name)] ?? 99}
            formatter={(value, name) => {
              if (name === 'tokens') {
                return [formatNumber(Number(value)), 'tokens'];
              }
              if (name === '轮次') {
                return [formatNumber(Number(value)), '轮次'];
              }
              return [formatPercent(value === null ? null : Number(value)), '缓存命中率'];
            }}
            labelFormatter={(label) => String(label ?? '')}
            contentStyle={{ borderRadius: 8, border: `1px solid ${colors.line}`, fontSize: 12 }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            itemSorter={null}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            name="tokens"
            stroke={colors.tokens}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="rounds"
            type="monotone"
            dataKey="rounds"
            name="轮次"
            stroke={colors.rounds}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="cache_hit_rate"
            name="缓存命中率"
            stroke={colors.rate}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 2, strokeWidth: 0, fill: colors.rate }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
