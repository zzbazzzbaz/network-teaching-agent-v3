import { useMemo } from 'react';

import { useEchart } from '@/lib/use-echart';

import { buildDailyTrendOption, type TrendPoint } from './chart-option';

export function DailyTrendChart({
  data,
  showActiveStudents = false,
}: {
  data: TrendPoint[];
  showActiveStudents?: boolean;
}) {
  const option = useMemo(
    () => buildDailyTrendOption(data, showActiveStudents),
    [data, showActiveStudents],
  );
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
