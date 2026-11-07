export type DiagramKind = 'mermaid' | 'html' | 'echarts';

const KINDS = new Set<string>(['mermaid', 'html', 'echarts']);

export function diagramKind(lang: string | undefined): DiagramKind | null {
  const name = (lang ?? '').trim().toLowerCase().split(/\s+/)[0] ?? '';
  return KINDS.has(name) ? (name as DiagramKind) : null;
}
