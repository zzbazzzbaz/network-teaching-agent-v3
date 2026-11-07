import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';
import { Button, Typography } from 'antd';
import type { ToolCallBlock, ToolResultBlock } from '@agentscope-ai/agentscope/message';
import { useState } from 'react';

import { describeToolCall, describeToolResult, toolStatus } from '@/lib/agentscope/render-policy';

const RAW_LIMIT = 400;

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

export interface ToolChainProps {
  calls: ToolCallBlock[];
  results: Map<string, ToolResultBlock>;
}

export function ToolChain({ calls, results }: ToolChainProps) {
  const items: ThoughtChainItemType[] = calls.map((call) => {
    const callView = describeToolCall(call);
    const result = results.get(call.id);
    const resultView = result ? describeToolResult(result) : null;
    return {
      key: call.id,
      title: callView.title,
      description: callView.waitingLabel ?? callView.description,
      status: toolStatus(call, result),
      collapsible: Boolean(resultView),
      content: resultView ? <ResultBody summary={resultView.summary} raw={resultView.raw} /> : null,
    };
  });

  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2">
      <ThoughtChain items={items} />
    </div>
  );
}
