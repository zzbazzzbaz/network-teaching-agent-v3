export const HTML_BLOCK_MAX_HEIGHT = 700;

const BASE_STYLE = `
  :root {
    --ink: #121a1c;
    --muted: #5c6e70;
    --line: #dce3e1;
    --brand: #0e6b60;
    --brand-soft: #e7f1ee;
    --brand-line: #b9d8d1;
    --hint: #9a5900;
    --surface: #ffffff;
    --paper: #f2f4f3;
    --surface-2: #eef2f1;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    padding: 2px;
    background: transparent;
    color: var(--ink);
    font-family: ui-sans-serif, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    line-height: 1.7;
    overflow-wrap: anywhere;
    -webkit-font-smoothing: antialiased;
  }
  body > *:first-child { margin-top: 0; }
  body > *:last-child { margin-bottom: 0; }
  p { margin: 0 0 8px; }
  h1, h2, h3 { margin: 0 0 8px; font-size: 20px; font-weight: 700; line-height: 1.4; }
  h4, h5, h6 { margin: 0 0 6px; font-size: 16px; font-weight: 700; line-height: 1.45; }
  small { font-size: 13px; color: var(--muted); }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 2px 0; }
  a { color: var(--brand); text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong, b { font-weight: 600; }
  table { border-collapse: collapse; margin: 0 0 8px; font-size: 13px; }
  th, td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: var(--surface-2); font-weight: 600; }
  code, kbd, pre, samp { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 12.5px; }
  :not(pre) > code { padding: 1px 5px; border-radius: 4px; background: var(--paper); }
  pre { margin: 0 0 8px; padding: 10px 12px; overflow-x: auto; border-radius: 6px; background: var(--paper); }
  pre code { padding: 0; background: transparent; }
  blockquote { margin: 0 0 8px; padding: 2px 12px; border-left: 2px solid var(--brand-line); color: var(--muted); }
  figure { margin: 0 0 8px; }
  img, svg { max-width: 100%; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 12px 0; }
  button, input, select, textarea { font: inherit; }
`;

const RESIZE_SCRIPT = `
  (function () {
    var last = 0;
    function report() {
      var height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0
        )
      );
      if (!height || Math.abs(height - last) < 1) return;
      last = height;
      parent.postMessage({ source: 'netclass-html-block', height: height }, '*');
    }
    window.addEventListener('load', report);
    window.addEventListener('resize', report);
    if (typeof ResizeObserver !== 'undefined') {
      var observer = new ResizeObserver(report);
      observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
    }
    document.addEventListener('click', function () {
      setTimeout(report, 0);
    });
    setTimeout(report, 0);
    setTimeout(report, 60);
  })();
`;

export function buildHtmlDocument(content: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${BASE_STYLE}</style>
</head>
<body>
${content}
<script>${RESIZE_SCRIPT}</script>
</body>
</html>`;
}
