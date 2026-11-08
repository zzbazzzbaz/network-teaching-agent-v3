import type { EChartsCoreOption } from '@/lib/echarts';
import { formatNumber } from '@/lib/format';

const TOKENS_COLOR = '#12586B';
const ROUNDS_COLOR = '#9A6A16';
const STUDENTS_COLOR = '#3F7D4E';
const LINE_COLOR = '#E4E8ED';
const LABEL_COLOR = '#6B7684';

export interface TrendPoint {
  date: string;
  tokens: number;
  rounds: number;
  active_students?: number;
}

export function buildDailyTrendOption(
  data: TrendPoint[],
  showActiveStudents = false,
): EChartsCoreOption {
  const series: Array<Record<string, unknown>> = [
    {
      name: 'tokens',
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
      data: data.map((item) => item.tokens),
    },
    {
      name: '轮次',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
      data: data.map((item) => item.rounds),
    },
  ];
  if (showActiveStudents) {
    series.push({
      name: '活跃学生',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, type: 'dashed' },
      data: data.map((item) => item.active_students ?? 0),
    });
  }
  return {
    color: showActiveStudents
      ? [TOKENS_COLOR, ROUNDS_COLOR, STUDENTS_COLOR]
      : [TOKENS_COLOR, ROUNDS_COLOR],
    animation: false,
    grid: { top: 48, right: 12, bottom: 8, left: 12, containLabel: true },
    legend: { top: 4, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, itemGap: 16 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: LINE_COLOR, type: 'dashed' } },
      valueFormatter: (value: unknown) => formatNumber(Number(value)),
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      axisLine: { lineStyle: { color: LINE_COLOR } },
      axisLabel: {
        color: LABEL_COLOR,
        fontSize: 11,
        formatter: (value: string) => (value.length >= 10 ? value.slice(5) : value),
      },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          color: LABEL_COLOR,
          fontSize: 11,
          formatter: (value: number) => formatNumber(value),
        },
        splitLine: { lineStyle: { color: LINE_COLOR, type: 'dashed' } },
      },
      {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: LABEL_COLOR, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series,
  };
}
