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
  color: ['#0e6b60', '#9a5900', '#3f7d4e', '#b9d8d1', '#2e4044', '#5c6e70'],
  textStyle: {
    color: '#121a1c',
    fontSize: 12,
    fontFamily:
      "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  },
  legend: { textStyle: { color: '#46575a' } },
  tooltip: {
    confine: true,
    backgroundColor: '#121a1c',
    borderWidth: 0,
    textStyle: { color: '#ffffff', fontSize: 11 },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#dce4e2' } },
    axisTick: { lineStyle: { color: '#dce4e2' } },
    axisLabel: { color: '#5c6e70' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#5c6e70' },
    splitLine: { lineStyle: { color: '#e7ecea' } },
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
