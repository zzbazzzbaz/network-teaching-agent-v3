import { BarChart, GaugeChart, PieChart, ScatterChart } from 'echarts/charts';

import { echarts, type EChartsCoreOption } from '@/lib/echarts';
import { useEchart } from '@/lib/use-echart';

echarts.use([BarChart, GaugeChart, PieChart, ScatterChart]);

export default function EchartsBlock({ option }: { option: EChartsCoreOption }) {
  const mountRef = useEchart(option);

  return (
    <div
      className="my-3 rounded-card border border-line bg-surface p-3"
      role="img"
      aria-label="图表"
    >
      <div ref={mountRef} className="w-full" style={{ height: 300 }} />
    </div>
  );
}
