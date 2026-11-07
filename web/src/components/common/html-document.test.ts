import { describe, expect, it } from 'vitest';

import { buildHtmlDocument } from './html-document';

describe('HTML 配图文档', () => {
  it('注入基础排版与高度上报脚本', () => {
    const document = buildHtmlDocument('<div>应用层</div>');

    expect(document.startsWith('<!doctype html>')).toBe(true);
    expect(document).toContain('<div>应用层</div>');
    expect(document).toContain('font-size: 14px');
    expect(document).toContain('--brand: #0e6b60');
    expect(document).toContain('parent.postMessage');
  });

  it('保留分步模板自带的脚本', () => {
    const steps = '<script id="renderer">render()</script>';
    const document = buildHtmlDocument(steps);

    expect(document).toContain(steps);
    expect(document.indexOf(steps)).toBeLessThan(document.indexOf('parent.postMessage'));
  });
});
