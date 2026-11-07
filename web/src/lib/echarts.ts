import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

export const CHART_THEME = 'netclass';

const THEME = {
  color: ['#0e6b60', '#9a5900', '#5c6e70', '#b9d8d1', '#12586b', '#1b7089'],
  textStyle: {
    color: '#121a1c',
    fontSize: 12,
    fontFamily:
      "ui-sans-serif, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  },
  legend: { textStyle: { color: '#5c6e70' } },
  tooltip: {
    confine: true,
    backgroundColor: '#ffffff',
    borderColor: '#dce3e1',
    textStyle: { color: '#121a1c', fontSize: 12 },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#dce3e1' } },
    axisTick: { lineStyle: { color: '#dce3e1' } },
    axisLabel: { color: '#5c6e70' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#5c6e70' },
    splitLine: { lineStyle: { color: '#eef2f1' } },
  },
};

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

echarts.registerTheme(CHART_THEME, THEME);

export { echarts };
export type { EChartsCoreOption, EChartsType } from 'echarts/core';
