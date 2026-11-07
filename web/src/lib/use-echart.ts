import { useEffect, useRef } from 'react';

import { CHART_THEME, echarts, type EChartsCoreOption } from './echarts';

export function useEchart(option: EChartsCoreOption) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = mountRef.current;
    if (!element) {
      return;
    }
    const chart = echarts.init(element, CHART_THEME, { renderer: 'canvas' });
    chart.setOption(option, { notMerge: true });
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chart.resize());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return mountRef;
}
