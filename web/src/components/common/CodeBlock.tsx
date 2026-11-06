import { CodeHighlighter } from '@ant-design/x';
import { lazy, Suspense } from 'react';

const MermaidLazy = lazy(() => import('./mermaid-block'));

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
    <div className="my-3 overflow-hidden rounded-card border border-line bg-surface-sunken">
      <CodeHighlighter lang={lang} header={false}>
        {code}
      </CodeHighlighter>
    </div>
  );
}
