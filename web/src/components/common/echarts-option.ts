export type ChartOption = Record<string, unknown>;

const OVERRIDDEN_KEYS = ['title', 'color', 'backgroundColor'];

export function parseChartOption(source: string): ChartOption | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const option = { ...(parsed as ChartOption) };
  for (const key of OVERRIDDEN_KEYS) {
    delete option[key];
  }
  if (!Array.isArray(option.series) || option.series.length === 0) {
    return null;
  }
  return option;
}
