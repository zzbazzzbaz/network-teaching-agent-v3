import { useEffect, useMemo, useRef, useState } from 'react';

import { buildHtmlDocument, HTML_BLOCK_MAX_HEIGHT } from './html-document';

const MIN_HEIGHT = 32;
const MESSAGE_SOURCE = 'netclass-html-block';

export default function HtmlBlock({ code }: { code: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const html = useMemo(() => buildHtmlDocument(code), [code]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) {
        return;
      }
      const data = event.data as { source?: string; height?: number } | null;
      if (!data || data.source !== MESSAGE_SOURCE || typeof data.height !== 'number') {
        return;
      }
      const next = Math.min(Math.max(Math.ceil(data.height), MIN_HEIGHT), HTML_BLOCK_MAX_HEIGHT);
      setHeight((current) => (Math.abs(current - next) < 1 ? current : next));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="my-3 overflow-hidden rounded-card border border-line bg-surface">
      <iframe
        ref={frameRef}
        title="图解"
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="block w-full border-0"
        style={{ height }}
      />
    </div>
  );
}
