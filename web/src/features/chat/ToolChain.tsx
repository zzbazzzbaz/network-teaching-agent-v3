import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';
import { Button, Typography } from 'antd';
import type { ToolCallBlock, ToolResultBlock } from '@agentscope-ai/agentscope/message';
import { useState } from 'react';

import { describeToolCall, describeToolResult, toolStatus } from '@/lib/agentscope/render-policy';

import { Markdown } from './markdown';

const RAW_LIMIT = 400;
const MEMORY_TOOLS = new Set(['memory_search', 'search_knowledge']);

function ResultBody({ summary, raw }: { summary: string; raw: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!raw) {
    return <Typography.Text type="secondary">{summary}</Typography.Text>;
  }
  const truncated = raw.length > RAW_LIMIT && !expanded;
  const text = truncated ? `${raw.slice(0, RAW_LIMIT)}…` : raw;
  return (
    <div className="flex flex-col gap-1">
      <pre className="m-0 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-chip bg-surface-sunken px-2.5 py-2 font-code text-xs leading-[1.5]">
        {text}
      </pre>
      {raw.length > RAW_LIMIT ? (
        <Button type="link" size="small" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起' : '展开全部'}
        </Button>
      ) : null}
    </div>
  );
}

function MemoryResult({ raw }: { raw: string }) {
  return (
    <div className="max-h-80 min-w-0 overflow-x-hidden overflow-y-auto rounded-chip border border-line bg-surface-sunken/40 px-3 py-2">
      <Markdown
        content={raw.replace(/^-\s+/, '')}
        className="text-[13px] leading-6 [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-[14px] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[13.5px] [&_h3]:text-[13px]"
      />
    </div>
  );
}

export interface ToolChainProps {
  calls: ToolCallBlock[];
  results: Map<string, ToolResultBlock>;
}

export function ToolChain({ calls, results }: ToolChainProps) {
  const expandedKeys: string[] = [];

  const items: ThoughtChainItemType[] = calls.map((call) => {
    const callView = describeToolCall(call);
    const result = results.get(call.id);
    const resultView = result ? describeToolResult(result) : null;
    const memory = MEMORY_TOOLS.has(call.name) && Boolean(resultView?.raw);

    if (memory) {
      expandedKeys.push(call.id);
    }

    return {
      key: call.id,
      title: callView.title,
      description: callView.description,
      status: toolStatus(call, result),
      collapsible: Boolean(resultView),
      content: resultView ? (
        memory && resultView.raw ? (
          <MemoryResult raw={resultView.raw} />
        ) : (
          <ResultBody summary={resultView.summary} raw={resultView.raw} />
        )
      ) : null,
    };
  });

  return (
    <div className="min-w-0 overflow-hidden rounded-card border border-line bg-surface px-3 py-2">
      <ThoughtChain items={items} defaultExpandedKeys={expandedKeys} />
    </div>
  );
}
