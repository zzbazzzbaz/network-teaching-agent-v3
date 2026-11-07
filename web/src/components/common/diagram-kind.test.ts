import { describe, expect, it } from 'vitest';

import { diagramKind } from './diagram-kind';

describe('配图语言标记', () => {
  it('识别 mermaid、html、echarts', () => {
    expect(diagramKind('mermaid')).toBe('mermaid');
    expect(diagramKind('html')).toBe('html');
    expect(diagramKind('echarts')).toBe('echarts');
  });

  it('忽略大小写、首尾空白与附加参数', () => {
    expect(diagramKind(' Mermaid ')).toBe('mermaid');
    expect(diagramKind('HTML')).toBe('html');
    expect(diagramKind('echarts {renderer:canvas}')).toBe('echarts');
  });

  it('其他语言标记不当作配图', () => {
    expect(diagramKind('ts')).toBeNull();
    expect(diagramKind('json')).toBeNull();
    expect(diagramKind('')).toBeNull();
    expect(diagramKind(undefined)).toBeNull();
  });
});
