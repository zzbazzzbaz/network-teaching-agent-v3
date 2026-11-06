import { CodeHighlighter } from '@ant-design/x';
import { lazy, Suspense } from 'react';

import styles from './CodeBlock.module.css';

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
          <pre className={styles.mermaidFallback}>
            <code>{code}</code>
          </pre>
        }
      >
        <MermaidLazy code={code} />
      </Suspense>
    );
  }
  return (
    <div className={styles.root}>
      <CodeHighlighter lang={lang} header={false}>
        {code}
      </CodeHighlighter>
    </div>
  );
}
