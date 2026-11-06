import type { AgentEvent } from '@agentscope-ai/agentscope/event';
import { createParser } from 'eventsource-parser';

export interface SseDecoder {
  push: (chunk: Uint8Array) => void;
  flush: () => void;
}

export function createSseDecoder(
  onData: (data: string) => void,
  onComment?: (comment: string) => void,
): SseDecoder {
  const parser = createParser({
    onEvent: (event) => {
      if (event.data) {
        onData(event.data);
      }
    },
    onComment,
  });
  const decoder = new TextDecoder('utf-8');
  return {
    push(chunk) {
      parser.feed(decoder.decode(chunk, { stream: true }));
    },
    flush() {
      const rest = decoder.decode();
      if (rest) {
        parser.feed(rest);
      }
    },
  };
}

export function parseAgentEvent(data: string): AgentEvent | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { type?: unknown }).type === 'string'
    ) {
      return parsed as AgentEvent;
    }
    return null;
  } catch {
    return null;
  }
}
