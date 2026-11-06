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
import { formatNumber } from '@/lib/format';

function useChartColors() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { tokens: '#12586B', rounds: '#9A6A16', line: '#E4E8ED' };
    }
    const computed = getComputedStyle(document.documentElement);
    return {
      tokens: computed.getPropertyValue('--brand-600').trim() || '#12586B',
      rounds: computed.getPropertyValue('--warning').trim() || '#9A6A16',
      line: computed.getPropertyValue('--line').trim() || '#E4E8ED',
    };
  }, []);
}

const AXIS_PROPS = {
  tick: { fontSize: 11, fill: '#8A94A1' },
  axisLine: false,
  tickLine: false,
} as const;

function formatAxisDate(value: string): string {
  return value.length >= 10 ? value.slice(5) : value;
}

export function DailyTrendChart({ data }: { data: DailyStatsItem[] }) {
  const colors = useChartColors();

  return (
    <div className="min-h-[200px] w-full" role="img" aria-label="每日 tokens 与轮次趋势">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={formatAxisDate} />
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
          <Tooltip
            itemSorter={(item) => (item.name === 'tokens' ? 0 : 1)}
            formatter={(value, name) => [
              formatNumber(Number(value)),
              name === 'tokens' ? 'tokens' : '轮次',
            ]}
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
            isAnimationActive={false}
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
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
