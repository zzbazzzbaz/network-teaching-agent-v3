import type {
  DataBlock,
  Msg,
  ToolCallBlock,
  ToolResultBlock,
} from '@agentscope-ai/agentscope/message';

export type MessageSegment =
  | { kind: 'text'; key: string; text: string; streaming: boolean }
  | { kind: 'thinking'; key: string; text: string; streaming: boolean }
  | {
      kind: 'tools';
      key: string;
      calls: ToolCallBlock[];
      results: Map<string, ToolResultBlock>;
    }
  | { kind: 'image'; key: string; src: string; alt: string };

export interface MessageSegments {
  segments: MessageSegment[];
  quizCalls: ToolCallBlock[];
}

function imageSource(block: DataBlock): string | null {
  if (block.source.type === 'url') {
    return block.source.url;
  }
  if (!block.source.data) {
    return null;
  }
  return `data:${block.source.media_type};base64,${block.source.data}`;
}

export function buildSegments(message: Msg): MessageSegments {
  const results = new Map<string, ToolResultBlock>();
  for (const block of message.content) {
    if (block.type === 'tool_result') {
      results.set(block.id, block);
    }
  }

  const segments: MessageSegment[] = [];
  const quizCalls: ToolCallBlock[] = [];
  let pendingCalls: ToolCallBlock[] = [];
  let index = 0;

  const flushTools = () => {
    if (pendingCalls.length === 0) {
      return;
    }
    segments.push({
      kind: 'tools',
      key: `tools-${pendingCalls[0]?.id ?? index}`,
      calls: pendingCalls,
      results,
    });
    pendingCalls = [];
  };

  for (const block of message.content) {
    switch (block.type) {
      case 'text': {
        if (!block.text.trim()) {
          break;
        }
        flushTools();
        segments.push({
          kind: 'text',
          key: block.id,
          text: block.text,
          streaming: !block.finished_at,
        });
        break;
      }
      case 'thinking': {
        if (!block.thinking.trim()) {
          break;
        }
        flushTools();
        segments.push({
          kind: 'thinking',
          key: block.id,
          text: block.thinking,
          streaming: !block.finished_at,
        });
        break;
      }
      case 'tool_call': {
        if (block.name === 'quiz_student') {
          quizCalls.push(block);
        }
        pendingCalls.push(block);
        break;
      }
      case 'data': {
        const src = imageSource(block);
        if (!src) {
          break;
        }
        flushTools();
        segments.push({
          kind: 'image',
          key: block.id,
          src,
          alt: block.name ?? '图片',
        });
        break;
      }
      default:
        break;
    }
    index += 1;
  }

  flushTools();

  return { segments, quizCalls };
}

export function messagePlainText(message: Msg): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('\n\n')
    .trim();
}
