import mermaid from 'mermaid';
import { useEffect, useState } from 'react';

const MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  theme: 'default',
  fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  themeVariables: {
    primaryColor: '#e7f1ee',
    primaryTextColor: '#121a1c',
    primaryBorderColor: '#b9d8d1',
    secondaryColor: '#f3f5f3',
    tertiaryColor: '#ffffff',
    lineColor: '#8aa7a1',
    textColor: '#121a1c',
    mainBkg: '#e7f1ee',
    nodeBorder: '#b9d8d1',
    clusterBkg: '#f7f9f8',
    clusterBorder: '#dce4e2',
    edgeLabelBackground: '#ffffff',
  },
} as const;

mermaid.initialize(MERMAID_CONFIG);

const SOURCE_CLASS =
  'my-3 overflow-x-auto rounded-card border border-line bg-surface-sunken p-3 font-code text-[12.5px] leading-[1.7]';

let diagramSeq = 0;

function toIntrinsicSize(markup: string): string {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const svg = template.content.querySelector('svg');
  if (!svg) {
    return markup;
  }
  const { width, height } = svg.viewBox.baseVal;
  if (!(width > 0 && height > 0)) {
    return markup;
  }
  svg.setAttribute('width', `${Math.ceil(width)}`);
  svg.setAttribute('height', `${Math.ceil(height)}`);
  svg.style.removeProperty('max-width');
  return svg.outerHTML;
}

async function renderDiagram(code: string): Promise<string> {
  const valid = await mermaid.parse(code, { suppressErrors: true });
  if (!valid) {
    throw new Error('Mermaid 语法无效');
  }
  diagramSeq += 1;
  const { svg } = await mermaid.render(`mermaid-block-${diagramSeq}`, code);
  return toIntrinsicSize(svg);
}

interface Rendered {
  code: string;
  svg: string;
}

export default function MermaidBlock({ code }: { code: string }) {
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [failedCode, setFailedCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderDiagram(code)
      .then((svg) => {
        if (!cancelled) {
          setRendered({ code, svg });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailedCode(code);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const failed = failedCode === code;
  const svg = !failed && rendered?.code === code ? rendered.svg : null;

  if (!svg) {
    return (
      <pre className={SOURCE_CLASS}>
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div className="my-3 overflow-x-auto rounded-card border border-line bg-surface p-3">
      <div
        className="mx-auto w-fit [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
