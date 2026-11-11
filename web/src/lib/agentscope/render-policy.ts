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
  memory_search: '检索学习记忆',
  materials_ls: '浏览资料',
  materials_read: '读取资料',
  materials_grep: '检索资料',
  search_knowledge: '检索知识库',
};

const MAX_RAW_CHARS = 400;
const SKILL_TOOL_NAME = 'Skill';

function titleOf(name: string): string {
  return TOOL_TITLES[name] ?? name;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pathOf(input: Record<string, unknown> | null): string {
  return textOf(input?.path);
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

  if (block.name === 'memory_search') {
    const query = textOf(input?.query) || textOf(input?.keywords) || textOf(input?.question);
    return {
      title,
      description: query ? `「${query}」` : '检索中',
      waitingLabel: null,
    };
  }

  if (block.name === 'search_knowledge') {
    const query = textOf(input?.query) || textOf(input?.question);
    return {
      title,
      description: query ? `「${query}」` : '检索中',
      waitingLabel: null,
    };
  }

  if (block.name === SKILL_TOOL_NAME) {
    const skill = textOf(input?.skill) || textOf(input?.name);
    return {
      title,
      description: skill,
      waitingLabel: null,
    };
  }

  if (block.name === 'materials_ls' || block.name === 'materials_read') {
    return {
      title,
      description: pathOf(input),
      waitingLabel: null,
    };
  }

  if (block.name === 'materials_grep') {
    const query = textOf(input?.query);
    return {
      title,
      description: query ? `「${query}」` : pathOf(input),
      waitingLabel: null,
    };
  }

  return {
    title,
    description: '',
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

  if (block.name === SKILL_TOOL_NAME) {
    return {
      summary: block.state === 'error' ? '加载失败' : '已加载',
      raw: null,
      hidden: false,
    };
  }

  if (block.name === 'memory_search') {
    const entries = splitMemoryEntries(raw);
    if (entries.length === 0) {
      return { summary: '没有命中结果', raw: null, hidden: false };
    }
    return { summary: `检索到 ${entries.length} 条记忆`, raw: null, hidden: false };
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
