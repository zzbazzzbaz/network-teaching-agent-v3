import { CodeHighlighter } from '@ant-design/x';
import { lazy, Suspense, useMemo } from 'react';

import { parseChartOption } from './echarts-option';

const MermaidLazy = lazy(() => import('./mermaid-block'));
const HtmlLazy = lazy(() => import('./html-block'));
const EchartsLazy = lazy(() => import('./echarts-block'));

function dedent(code: string): string {
  const lines = code.split('\n');
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^ */)?.[0].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  if (min === 0) {
    return code;
  }
  return lines.map((line) => line.slice(min)).join('\n');
}

const SOURCE_STYLES = {
  code: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    overflow: 'visible',
  },
};

function SourceCode({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="md-code-block my-3 overflow-x-auto rounded-card border border-line bg-surface-sunken px-3.5 py-3 font-code text-[12.5px] leading-[1.7]">
      <CodeHighlighter lang={lang} header={false} styles={SOURCE_STYLES}>
        {dedent(code)}
      </CodeHighlighter>
    </div>
  );
}

function Loading({ code }: { code: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-card border border-line bg-surface-sunken p-3 font-code text-[13px] leading-[1.6]">
      <code>{dedent(code)}</code>
    </pre>
  );
}

export interface CodeBlockProps {
  code: string;
  lang?: string;
  mermaid?: boolean;
  html?: boolean;
  echarts?: boolean;
}

export function CodeBlock({
  code,
  lang,
  mermaid = false,
  html = false,
  echarts = false,
}: CodeBlockProps) {
  const chartOption = useMemo(() => (echarts ? parseChartOption(code) : null), [code, echarts]);

  if (mermaid) {
    return (
      <Suspense fallback={<Loading code={code} />}>
        <MermaidLazy code={code} />
      </Suspense>
    );
  }

  if (html) {
    if (!code.trim()) {
      return null;
    }
    return (
      <Suspense fallback={<Loading code={code} />}>
        <HtmlLazy code={code} />
      </Suspense>
    );
  }

  if (chartOption) {
    return (
      <Suspense fallback={<Loading code={code} />}>
        <EchartsLazy option={chartOption} />
      </Suspense>
    );
  }

  return <SourceCode code={code} lang={lang} />;
}
