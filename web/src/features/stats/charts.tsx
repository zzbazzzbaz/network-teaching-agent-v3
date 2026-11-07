import { useMemo } from 'react';

import type { DailyStatsItem } from '@/api/types';
import { useEchart } from '@/lib/use-echart';

import { buildDailyTrendOption } from './chart-option';

export function DailyTrendChart({ data }: { data: DailyStatsItem[] }) {
  const option = useMemo(() => buildDailyTrendOption(data), [data]);
  const mountRef = useEchart(option);

  return (
    <div
      ref={mountRef}
      className="w-full"
      style={{ height: 300 }}
      role="img"
      aria-label="每日 tokens 与轮次趋势"
    />
  );
}
