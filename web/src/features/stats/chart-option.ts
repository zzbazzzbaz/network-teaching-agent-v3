import type { EChartsCoreOption } from '@/lib/echarts';
import { formatNumber } from '@/lib/format';

const TOKENS_COLOR = '#0E6B60';
const ROUNDS_COLOR = '#9A5900';
const STUDENTS_COLOR = '#3F7D4E';
const LINE_COLOR = '#DCE4E2';
const LABEL_COLOR = '#5C6E70';
const MONO_FONT = "'IBM Plex Mono', ui-monospace, monospace";
const SANS_FONT =
  "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

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
    textStyle: { fontFamily: SANS_FONT },
    grid: { top: 48, right: 12, bottom: 8, left: 12, containLabel: true },
    legend: {
      top: 4,
      left: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { color: '#46575A', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#121A1C',
      borderWidth: 0,
      padding: [8, 10],
      textStyle: { color: '#FFFFFF', fontSize: 11, fontFamily: SANS_FONT },
      axisPointer: { type: 'line', lineStyle: { color: LINE_COLOR, type: 'dashed' } },
      valueFormatter: (value: unknown) => formatNumber(Number(value)),
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      axisLine: { lineStyle: { color: LINE_COLOR } },
      axisLabel: {
        color: LABEL_COLOR,
        fontSize: 10.5,
        fontFamily: MONO_FONT,
        formatter: (value: string) => (value.length >= 10 ? value.slice(5) : value),
      },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          color: LABEL_COLOR,
          fontSize: 10.5,
          fontFamily: MONO_FONT,
          formatter: (value: number) => formatNumber(value),
        },
        splitLine: { lineStyle: { color: LINE_COLOR, type: 'dashed' } },
      },
      {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: LABEL_COLOR, fontSize: 10.5, fontFamily: MONO_FONT },
        splitLine: { show: false },
      },
    ],
    series,
  };
}
