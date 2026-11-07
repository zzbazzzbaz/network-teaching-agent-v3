import type { ComponentProps } from '@ant-design/x-markdown';
import { XMarkdown } from '@ant-design/x-markdown';
import type { MarkedExtension } from 'marked';
import { Image } from 'antd';
import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react';

import { diagramKind } from '@/components/common/diagram-kind';
import { nodeText } from '@/lib/node-text';

const LazyCodeBlock = lazy(() =>
  import('@/components/common/CodeBlock').then((module) => ({ default: module.CodeBlock })),
);

function CodeBlock(props: {
  code: string;
  lang?: string;
  mermaid?: boolean;
  html?: boolean;
  echarts?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <pre className="my-3 overflow-x-auto rounded-card border border-line bg-surface-sunken p-3 font-code text-[13px] leading-[1.6]">
          <code>{props.code}</code>
        </pre>
      }
    >
      <LazyCodeBlock {...props} />
    </Suspense>
  );
}

const EMPTY_CONFIG: MarkedExtension = {};

function useMarkdownConfig(content: string): MarkedExtension {
  const [config, setConfig] = useState<MarkedExtension>(EMPTY_CONFIG);

  useEffect(() => {
    if (config !== EMPTY_CONFIG || !content.includes('$')) {
      return;
    }
    let cancelled = false;
    void import('@ant-design/x-markdown/plugins/Latex').then((module) => {
      if (!cancelled) {
        setConfig({ extensions: module.default() });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [config, content]);

  return config;
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href, window.location.origin);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function MarkdownCode(props: ComponentProps) {
  const { block, lang, streamStatus, children } = props;
  const code = nodeText(children);
  if (!block) {
    if (code.includes('\n')) {
      return (
        <span className="my-3 block rounded-card border border-line bg-surface-sunken px-3 py-2.5 font-code text-[12.5px] leading-[1.7] whitespace-pre-wrap break-words">
          {code.trim()}
        </span>
      );
    }
    return (
      <code className="rounded bg-surface-sunken px-1 py-px text-[0.92em]">{code.trim()}</code>
    );
  }
  const language = (lang ?? '').trim().toLowerCase();
  const kind = diagramKind(language);
  const ready = streamStatus === 'done';
  if (kind === 'mermaid') {
    return <CodeBlock code={code} lang="mermaid" mermaid={ready} />;
  }
  if (kind === 'html') {
    return <CodeBlock code={code} lang="html" html={ready} />;
  }
  if (kind === 'echarts') {
    return <CodeBlock code={code} lang="json" echarts={ready} />;
  }
  return <CodeBlock code={code} lang={language || undefined} />;
}

function MarkdownPre(props: ComponentProps) {
  return <>{props.children}</>;
}

function MarkdownLink(props: ComponentProps) {
  const href = typeof props.href === 'string' ? props.href : '';
  if (!href || !isSafeHref(href)) {
    return <span className="text-ink-muted underline decoration-dotted">{props.children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  );
}

function MarkdownImage(props: ComponentProps) {
  const src = typeof props.src === 'string' ? props.src : '';
  if (!src) {
    return null;
  }
  const alt = typeof props.alt === 'string' ? props.alt : '';
  return (
    <Image
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className="max-w-full rounded-chip border border-line"
      style={{ maxWidth: 320 }}
    />
  );
}

function MarkdownTable(props: ComponentProps) {
  return (
    <div className="my-3 max-w-full overflow-x-auto">
      <table>{props.children}</table>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Record<string, ComponentType<ComponentProps>> = {
  code: MarkdownCode,
  pre: MarkdownPre,
  a: MarkdownLink,
  img: MarkdownImage,
  table: MarkdownTable,
};

const MARKDOWN_COMPONENT_PROPS: Record<string, Record<string, unknown>> = {};

export interface MarkdownProps {
  content: string;
  streaming?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Markdown({ content, streaming = false, className }: MarkdownProps) {
  const config = useMarkdownConfig(content);
  return (
    <div
      className={`markdown-body ${streaming ? 'streaming-caret' : ''} ${className ?? ''}`}
      data-streaming={streaming ? 'true' : 'false'}
    >
      <XMarkdown
        content={content}
        streaming={streaming}
        config={config}
        components={MARKDOWN_COMPONENTS}
        componentsProps={MARKDOWN_COMPONENT_PROPS}
        escapeRawHtml
        openLinksInNewTab
      />
    </div>
  );
}
