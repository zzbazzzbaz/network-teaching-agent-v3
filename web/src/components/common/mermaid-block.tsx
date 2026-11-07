import { Mermaid } from '@ant-design/x';
import mermaid from 'mermaid';
import { useEffect, useState } from 'react';

const MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  theme: 'default',
  fontFamily: "ui-sans-serif, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
} as const;

mermaid.initialize(MERMAID_CONFIG);

export default function MermaidBlock({ code }: { code: string }) {
  const [validation, setValidation] = useState({ code, invalid: false });

  useEffect(() => {
    let cancelled = false;
    mermaid
      .parse(code, { suppressErrors: true })
      .then((result) => {
        if (!cancelled) {
          setValidation({ code, invalid: result === false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setValidation({ code, invalid: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (validation.code === code && validation.invalid) {
    return (
      <pre className="my-3 overflow-x-auto rounded-card border border-line bg-surface-sunken p-3 font-code text-[12.5px] leading-[1.7]">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div className="my-3 overflow-x-auto rounded-card border border-line bg-surface p-2">
      <Mermaid config={MERMAID_CONFIG}>{code}</Mermaid>
    </div>
  );
}
