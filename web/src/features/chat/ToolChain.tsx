import type { ToolCallBlock, ToolResultBlock } from '@agentscope-ai/agentscope/message';
import { CheckCircle2, ChevronDown, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';

import { describeToolCall, describeToolResult, toolStatus } from '@/lib/agentscope/render-policy';

function StatusIcon({ status }: { status: ReturnType<typeof toolStatus> }) {
  if (status === 'loading') {
    return <Loader2 className="size-3 animate-spin text-ink-subtle" aria-hidden="true" />;
  }
  if (status === 'error' || status === 'abort') {
    return <XCircle className="size-3 text-danger" aria-hidden="true" />;
  }
  return <CheckCircle2 className="size-3 text-ink-subtle" aria-hidden="true" />;
}

function ToolBody({ raw }: { raw: string }) {
  return (
    <pre className="m-0 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-chip bg-surface-sunken/50 px-3 py-2 font-code text-[12px] leading-[1.6]">
      {raw}
    </pre>
  );
}

function ToolRow({ call, result }: { call: ToolCallBlock; result: ToolResultBlock | undefined }) {
  const callView = describeToolCall(call);
  const resultView = result ? describeToolResult(result) : null;
  const hasBody = Boolean(resultView?.raw);
  const [open, setOpen] = useState(false);

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
          <ChevronDown
            className={`size-3 shrink-0 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open && hasBody && resultView?.raw ? (
        <div className="mt-2 pl-[19px]">
          <ToolBody raw={resultView.raw} />
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
