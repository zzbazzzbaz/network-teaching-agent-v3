import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { ToolCallBlock, ToolResultBlock } from '@agentscope-ai/agentscope/message';
import { useState } from 'react';

import { describeToolCall, describeToolResult, toolStatus } from '@/lib/agentscope/render-policy';

import { Markdown } from './markdown';

const MEMORY_TOOLS = new Set(['memory_search']);

function StatusIcon({ status }: { status: ReturnType<typeof toolStatus> }) {
  if (status === 'loading') {
    return <LoadingOutlined className="text-[11px] text-ink-subtle" aria-hidden="true" />;
  }
  if (status === 'error' || status === 'abort') {
    return <CloseCircleOutlined className="text-[11px] text-danger" aria-hidden="true" />;
  }
  return <CheckCircleOutlined className="text-[11px] text-ink-subtle" aria-hidden="true" />;
}

function ToolBody({ raw, memory }: { raw: string; memory: boolean }) {
  if (memory) {
    return (
      <div className="max-h-72 overflow-y-auto rounded-chip bg-surface-sunken/50 px-3 py-2">
        <Markdown
          content={raw.replace(/^-\s+/, '')}
          className="text-[12.5px] leading-6 [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-[13.5px] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[13px] [&_h3]:text-[12.5px]"
        />
      </div>
    );
  }
  return (
    <pre className="m-0 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-chip bg-surface-sunken/50 px-3 py-2 font-code text-[12px] leading-[1.6]">
      {raw}
    </pre>
  );
}

function ToolRow({ call, result }: { call: ToolCallBlock; result: ToolResultBlock | undefined }) {
  const callView = describeToolCall(call);
  const resultView = result ? describeToolResult(result) : null;
  const memory = MEMORY_TOOLS.has(call.name) && Boolean(resultView?.raw);
  const hasBody = Boolean(resultView?.raw);
  const [open, setOpen] = useState(memory);

  return (
    <div className="px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={hasBody ? open : undefined}
        disabled={!hasBody}
        className="flex w-full items-center gap-2 text-left disabled:cursor-default"
      >
        <StatusIcon status={toolStatus(call, result)} />
        <span className="shrink-0 text-[12.5px] text-ink">{callView.title}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-subtle">
          {callView.description}
        </span>
        {resultView ? (
          <span className="shrink-0 text-[11px] text-ink-subtle">{resultView.summary}</span>
        ) : null}
        {hasBody ? (
          <DownOutlined
            className={`shrink-0 text-[9px] text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open && hasBody && resultView?.raw ? (
        <div className="mt-2 pl-[19px]">
          <ToolBody raw={resultView.raw} memory={memory} />
        </div>
      ) : null}
    </div>
  );
}

export interface ToolChainProps {
  calls: ToolCallBlock[];
  results: Map<string, ToolResultBlock>;
}

export function ToolChain({ calls, results }: ToolChainProps) {
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-surface">
      {calls.map((call) => (
        <ToolRow key={call.id} call={call} result={results.get(call.id)} />
      ))}
    </div>
  );
}
