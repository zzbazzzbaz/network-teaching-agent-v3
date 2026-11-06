import { describe, expect, it, vi } from 'vitest';

import { createSseDecoder, parseAgentEvent } from './parser';

const encoder = new TextEncoder();

function feedAll(
  chunks: string[],
  onData: (data: string) => void,
  onComment?: (c: string) => void,
) {
  const decoder = createSseDecoder(onData, onComment);
  chunks.forEach((chunk) => decoder.push(encoder.encode(chunk)));
  decoder.flush();
}

describe('SSE 解析', () => {
  it('一帧内多个事件全部产出', () => {
    const received: string[] = [];
    feedAll(
      [
        'data: {"type":"TEXT_BLOCK_DELTA","delta":"a"}\n\n',
        'data: {"type":"TEXT_BLOCK_DELTA","delta":"b"}\n\n',
      ],
      (data) => received.push(data),
    );
    expect(received).toHaveLength(2);
  });

  it('事件跨 chunk 切断仍能还原', () => {
    const received: string[] = [];
    feedAll(['data: {"type":"REPLY', '_START","reply_id":"r1"}\n\n'], (data) =>
      received.push(data),
    );
    expect(received).toEqual(['{"type":"REPLY_START","reply_id":"r1"}']);
  });

  it('心跳注释帧不产生事件', () => {
    const received: string[] = [];
    const comments: string[] = [];
    feedAll(
      [':\n\n', 'data: {"type":"REPLY_END"}\n\n'],
      (data) => received.push(data),
      (comment) => comments.push(comment),
    );
    expect(received).toHaveLength(1);
    expect(comments.length).toBeGreaterThan(0);
  });

  it('UTF-8 中文跨 chunk 不会乱码', () => {
    const bytes = encoder.encode('data: {"text":"三次握手"}\n\n');
    const decoder = createSseDecoder((data) => {
      expect(data).toBe('{"text":"三次握手"}');
    });
    const cut = bytes.indexOf(0xe4) + 1;
    decoder.push(bytes.slice(0, cut));
    decoder.push(bytes.slice(cut));
    decoder.flush();
  });

  it('非法 JSON 返回 null 而不抛错', () => {
    expect(parseAgentEvent('{oops')).toBeNull();
    expect(parseAgentEvent('{"type":"REPLY_END"}')).toMatchObject({ type: 'REPLY_END' });
  });
});

describe('SSE 解析器回调', () => {
  it('空 data 帧被忽略', () => {
    const onData = vi.fn();
    feedAll(['\n\n'], onData);
    expect(onData).not.toHaveBeenCalled();
  });
});
