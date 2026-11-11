import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Markdown } from './markdown';

const INTEGRAL = String.raw`\int_2^{+\infty}\frac{1}{\sqrt x}\,dx`;

function katexCount(container: HTMLElement): number {
  return container.querySelectorAll('.katex').length;
}

describe('Markdown 数学公式', () => {
  it('渲染 \\(...\\) 行内公式', async () => {
    const { container } = render(<Markdown content={String.raw`**(A)** \(${INTEGRAL}\)：发散`} />);
    await waitFor(() => expect(katexCount(container)).toBe(1));
    expect(container.textContent).not.toContain(String.raw`\int_2`);
  });

  it('渲染 $...$ 行内公式', async () => {
    const { container } = render(<Markdown content={`**(A)** $${INTEGRAL}$：发散`} />);
    await waitFor(() => expect(katexCount(container)).toBe(1));
  });

  it('渲染 $$...$$ 块级公式', async () => {
    const { container } = render(<Markdown content={`$$\n${INTEGRAL}\n$$`} />);
    await waitFor(() => expect(katexCount(container)).toBe(1));
  });

  it('渲染 \\[...\\] 块级公式', async () => {
    const { container } = render(<Markdown content={String.raw`\[${INTEGRAL}\]`} />);
    await waitFor(() => expect(katexCount(container)).toBe(1));
  });

  it('流式内容出现公式后补渲染', async () => {
    const { container, rerender } = render(<Markdown content="四个选项都是无穷限反常积分。" streaming />);
    rerender(<Markdown content={String.raw`四个选项都是无穷限反常积分。\(${INTEGRAL}\)`} streaming />);
    await waitFor(() => expect(katexCount(container)).toBe(1));
  });

  it('无公式内容不加载公式渲染', () => {
    const { container } = render(<Markdown content={'TCP 三次握手：SYN、SYN-ACK、ACK。'} />);
    expect(katexCount(container)).toBe(0);
    expect(container.textContent).toContain('TCP 三次握手');
  });
});
