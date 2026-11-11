import type { ComponentProps } from '@ant-design/x-markdown';
import { XMarkdown } from '@ant-design/x-markdown';
import type { MarkedExtension } from 'marked';
import { Image } from 'antd';
import { Sparkles } from 'lucide-react';
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

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

const MATH_DELIMITER = /(?:\$|\\\(|\\\[)/;

function useMarkdownConfig(content: string): MarkedExtension {
  const [config, setConfig] = useState<MarkedExtension>(EMPTY_CONFIG);
  const needsMath = MATH_DELIMITER.test(content);

  useEffect(() => {
    if (config !== EMPTY_CONFIG || !needsMath) {
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
  }, [config, needsMath]);

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
    return <code>{code.trim()}</code>;
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

export interface MarkdownImageAction {
  src: string;
  alt: string;
}

interface MarkdownImageOptions {
  maxWidth: number;
  onAction?: (info: MarkdownImageAction) => void;
}

const MarkdownImageContext = createContext<MarkdownImageOptions>({ maxWidth: 320 });

function MarkdownImage(props: ComponentProps) {
  const options = useContext(MarkdownImageContext);
  const src = typeof props.src === 'string' ? props.src : '';
  if (!src) {
    return null;
  }
  const alt = typeof props.alt === 'string' ? props.alt : '';
  if (!options.onAction) {
    return (
      <Image
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className="max-w-full rounded-chip border border-line"
        style={{ maxWidth: options.maxWidth }}
      />
    );
  }
  return (
    <span className="relative my-3 inline-block max-w-full">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="max-w-full rounded-chip border border-line"
        style={{ maxWidth: options.maxWidth }}
      />
      <button
        type="button"
        onClick={() => options.onAction?.({ src, alt })}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-line bg-surface/95 px-2 py-1 text-[11px] font-medium text-brand-strong shadow-sm backdrop-blur-sm transition-colors hover:border-brand-line hover:bg-brand-soft"
      >
        <Sparkles className="size-3" aria-hidden="true" />问 AI
      </button>
    </span>
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
  imageMaxWidth?: number;
  onImageAction?: (info: MarkdownImageAction) => void;
  children?: ReactNode;
}

export function Markdown({
  content,
  streaming = false,
  className,
  imageMaxWidth = 320,
  onImageAction,
}: MarkdownProps) {
  const config = useMarkdownConfig(content);
  return (
    <MarkdownImageContext.Provider value={{ maxWidth: imageMaxWidth, onAction: onImageAction }}>
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
          disableDefaultStyles
          escapeRawHtml
          openLinksInNewTab
        />
      </div>
    </MarkdownImageContext.Provider>
  );
}
