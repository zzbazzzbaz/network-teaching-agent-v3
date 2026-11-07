import { describe, expect, it } from 'vitest';

import type { DailyStatsItem } from '@/api/types';

import { buildDailyTrendOption } from './chart-option';

interface OptionShape {
  xAxis: { data: string[] };
  yAxis: Array<{ type: string }>;
  series: Array<{ name: string; yAxisIndex?: number; data: number[] }>;
}

const DATA: DailyStatsItem[] = [
  {
    date: '2026-11-01',
    tokens: 1200,
    cache_hit_rate: 0.5,
    rounds: 3,
    input_tokens: 900,
    output_tokens: 300,
    cache_input_tokens: 100,
  },
  {
    date: '2026-11-02',
    tokens: 1500,
    cache_hit_rate: null,
    rounds: 4,
    input_tokens: 1100,
    output_tokens: 400,
    cache_input_tokens: 140,
  },
];

function optionShape(data: DailyStatsItem[]): OptionShape {
  return buildDailyTrendOption(data) as unknown as OptionShape;
}

describe('每日趋势图 option', () => {
  it('日期作为类目轴，短横线格式在展示层处理', () => {
    const option = optionShape(DATA);
    expect(option.xAxis.data).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('tokens 与轮次分别使用左右两条数值轴', () => {
    const option = optionShape(DATA);
    expect(option.yAxis).toHaveLength(2);
    expect(option.series[0]).toMatchObject({ name: 'tokens', data: [1200, 1500] });
    expect(option.series[0]?.yAxisIndex).toBeUndefined();
    expect(option.series[1]).toMatchObject({ name: '轮次', data: [3, 4] });
    expect(option.series[1]?.yAxisIndex).toBe(1);
  });

  it('空数据也生成可渲染的 option', () => {
    const option = optionShape([]);
    expect(option.xAxis.data).toEqual([]);
    expect(option.series[0]?.data).toEqual([]);
    expect(option.series[1]?.data).toEqual([]);
  });
});
