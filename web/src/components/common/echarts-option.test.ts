import { describe, expect, it } from 'vitest';

import { parseChartOption } from './echarts-option';

const VALID = {
  title: { text: 'TODO' },
  color: ['#000000'],
  backgroundColor: '#ffffff',
  xAxis: { type: 'category', data: ['0', '1', '2'] },
  yAxis: { type: 'value', name: 'cwnd' },
  series: [{ type: 'line', step: 'end', data: [1, 2, 4] }],
};

describe('ECharts option 解析', () => {
  it('解析合法 JSON 并移除前端接管的字段', () => {
    const option = parseChartOption(JSON.stringify(VALID));

    expect(option).not.toBeNull();
    expect(option).not.toHaveProperty('title');
    expect(option).not.toHaveProperty('color');
    expect(option).not.toHaveProperty('backgroundColor');
    expect(option?.['series']).toEqual(VALID.series);
    expect(option?.['xAxis']).toEqual(VALID.xAxis);
  });

  it('语法错误时返回 null，交给源码展示', () => {
    expect(parseChartOption('{ "series": [ }')).toBeNull();
    expect(parseChartOption('const option = { series: [] }')).toBeNull();
  });

  it('顶层不是对象时返回 null', () => {
    expect(parseChartOption('[]')).toBeNull();
    expect(parseChartOption('"line"')).toBeNull();
    expect(parseChartOption('null')).toBeNull();
  });

  it('缺少可用 series 时返回 null', () => {
    expect(parseChartOption('{}')).toBeNull();
    expect(parseChartOption('{"series": []}')).toBeNull();
    expect(parseChartOption('{"series": {}}')).toBeNull();
  });
});
