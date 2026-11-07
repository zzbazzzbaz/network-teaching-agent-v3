import { CodeHighlighter } from '@ant-design/x';
import { lazy, Suspense } from 'react';

const MermaidLazy = lazy(() => import('./mermaid-block'));

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

export interface CodeBlockProps {
  code: string;
  lang?: string;
  mermaid?: boolean;
}

export function CodeBlock({ code, lang, mermaid = false }: CodeBlockProps) {
  if (mermaid) {
    return (
      <Suspense
        fallback={
          <pre className="my-3 overflow-x-auto rounded-card bg-surface-sunken p-3 font-code text-[13px]">
            <code>{code}</code>
          </pre>
        }
      >
        <MermaidLazy code={code} />
      </Suspense>
    );
  }
  return (
    <div className="my-3 overflow-x-auto rounded-card border border-line bg-surface-sunken px-3.5 py-3 font-code text-[12.5px] leading-[1.7] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[12px] [&_code]:leading-[1.7]">
      <CodeHighlighter lang={lang} header={false}>
        {dedent(code)}
      </CodeHighlighter>
    </div>
  );
}
