import type { ToolCallBlock, ToolResultBlock } from '@agentscope-ai/agentscope/message';

import { parseToolInput, QUIZ_TOOL_NAME } from './project';

export type ToolStatus = 'loading' | 'success' | 'error' | 'abort';

export interface ToolCallView {
  title: string;
  description: string;
  waitingLabel: string | null;
}

export interface ToolResultView {
  summary: string;
  raw: string | null;
  hidden: boolean;
}

const TOOL_TITLES: Record<string, string> = {
  [QUIZ_TOOL_NAME]: '检查题',
  get_question: '读取题目',
  memory_search: '检索学习记忆',
  search_knowledge: '检索知识库',
};

const MAX_RAW_CHARS = 400;

function titleOf(name: string): string {
  return TOOL_TITLES[name] ?? name;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function outputToText(block: ToolResultBlock): string {
  if (typeof block.output === 'string') {
    return block.output;
  }
  const parts: string[] = [];
  for (const item of block.output) {
    if (item.type === 'text') {
      parts.push(item.text);
    }
  }
  return parts.join('\n');
}

export function quizSubmittedAnswer(block: ToolResultBlock): string | null {
  if (block.name !== QUIZ_TOOL_NAME) {
    return null;
  }
  const match = outputToText(block).match(/学生答案[：:]\s*([^\n]+)/);
  return match ? match[1].trim() : null;
}

export function describeToolCall(block: ToolCallBlock): ToolCallView {
  const title = titleOf(block.name);
  const input = parseToolInput(block.input);

  if (block.name === QUIZ_TOOL_NAME) {
    const stem = textOf(input?.stem);
    const type = input?.question_type === 'short_answer' ? '简答题' : '单选题';
    return {
      title,
      description: stem ? `${type}：${stem}` : '正在准备检查题',
      waitingLabel: block.state === 'submitted' ? '等待作答' : null,
    };
  }

  if (block.name === 'get_question') {
    const questionId = textOf(input?.question_id);
    return {
      title,
      description: questionId ? `题目 ${questionId}` : '读取题目详情',
      waitingLabel: null,
    };
  }

  if (block.name === 'memory_search' || block.name === 'search_knowledge') {
    const query = textOf(input?.query) || textOf(input?.keywords) || textOf(input?.question);
    return {
      title,
      description: query ? `「${query}」` : '检索中',
      waitingLabel: null,
    };
  }

  return {
    title,
    description: input ? '已提交调用' : '准备中',
    waitingLabel: block.state === 'asking' ? '等待确认' : null,
  };
}

export function splitMemoryEntries(raw: string): string[] {
  return raw
    .split(/\n(?=-\s)/)
    .map((entry) => entry.replace(/^-\s*/, '').trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith('<!--'));
}

export function describeToolResult(block: ToolResultBlock): ToolResultView {
  const raw = outputToText(block).trim();

  if (block.name === QUIZ_TOOL_NAME) {
    return { summary: '已收到作答', raw: null, hidden: false };
  }

  if (block.name === 'get_question') {
    return { summary: '已读取题目', raw: null, hidden: false };
  }

  if (block.name === 'memory_search' || block.name === 'search_knowledge') {
    const entries = splitMemoryEntries(raw);
    if (entries.length === 0) {
      return { summary: '没有命中结果', raw: null, hidden: false };
    }
    const noun = block.name === 'memory_search' ? '条记忆' : '条资料';
    return { summary: `检索到 ${entries.length} ${noun}`, raw, hidden: false };
  }

  if (!raw) {
    return { summary: '无输出', raw: null, hidden: false };
  }

  if (block.state === 'error') {
    return {
      summary: raw.length > MAX_RAW_CHARS ? `${raw.slice(0, MAX_RAW_CHARS)}…` : raw,
      raw: null,
      hidden: false,
    };
  }

  return {
    summary: raw.length > 60 ? `${raw.slice(0, 60)}…` : raw,
    raw,
    hidden: false,
  };
}

export function toolStatus(call: ToolCallBlock, result: ToolResultBlock | undefined): ToolStatus {
  if (call.state !== 'finished') {
    return 'loading';
  }
  if (!result) {
    return 'abort';
  }
  if (result.state === 'error' || result.state === 'denied' || result.state === 'interrupted') {
    return 'error';
  }
  return 'success';
}
