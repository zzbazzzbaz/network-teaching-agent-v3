const enabled = import.meta.env.VITE_ENABLE_METRICS === 'true';
const isDev = import.meta.env.DEV;

type MetricTags = Record<string, string | number | boolean>;

interface MetricRecord {
  name: string;
  value: number;
  tags?: MetricTags;
  at: number;
}

declare global {
  interface Window {
    __metrics?: MetricRecord[];
  }
}

export function recordMetric(name: string, value = 1, tags?: MetricTags): void {
  if (!enabled) {
    if (isDev) {
      console.warn('[metric]', name, value, tags ?? {});
    }
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }
  window.__metrics = window.__metrics ?? [];
  window.__metrics.push({ name, value, tags, at: Date.now() });
  if (window.__metrics.length > 500) {
    window.__metrics.shift();
  }
}
