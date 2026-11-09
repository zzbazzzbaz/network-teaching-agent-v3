import { useQuery } from '@tanstack/react-query';
import { Checkbox, Popover, Tooltip } from 'antd';
import { ChevronDown, Database } from 'lucide-react';

import { listKnowledgeBases } from '@/api/knowledge';

const CHIP_CLASS =
  'inline-flex h-7 max-w-[280px] min-w-0 items-center gap-1.5 rounded-chip px-2 text-[11.5px] text-ink-muted';

export interface KnowledgePickerProps {
  value: string[] | null;
  onChange: (ids: string[]) => void;
}

export interface KnowledgeBadgeProps {
  ids: string[];
}

function useKnowledgeBases() {
  const query = useQuery({
    queryKey: ['knowledge-bases', 'mine', undefined],
    queryFn: () => listKnowledgeBases('mine'),
    retry: false,
    staleTime: 30_000,
  });
  return query.data?.items ?? [];
}

export function KnowledgePicker({ value, onChange }: KnowledgePickerProps) {
  const items = useKnowledgeBases();
  if (items.length === 0) {
    return null;
  }

  const selectedIds = (value ?? items.map((item) => item.id)).filter((id) =>
    items.some((item) => item.id === id),
  );
  const allSelected = items.every((item) => selectedIds.includes(item.id));
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const summary = allSelected
    ? '全部'
    : selected.length === 0
      ? '未启用'
      : selected.map((item) => item.name).join('、');

  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked ? [...selectedIds, id] : selectedIds.filter((selectedId) => selectedId !== id),
    );
  };

  const content = (
    <div className="w-64">
      <div className="mb-1 flex items-center justify-between px-1.5 pb-1 text-[11px] text-ink-subtle">
        <span>本轮对话启用</span>
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-brand transition-colors hover:text-brand-strong"
          onClick={() => onChange(allSelected ? [] : items.map((item) => item.id))}
        >
          {allSelected ? '清空' : '全选'}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded-chip px-1.5 py-1.5 transition-colors hover:bg-surface-sunken"
          >
            <Checkbox
              checked={selectedIds.includes(item.id)}
              onChange={(event) => toggle(item.id, event.target.checked)}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.name}</span>
            <span className="shrink-0 text-[11px] text-ink-subtle">
              {item.visibility === 'public' ? '公共' : '私人'}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="topLeft" arrow={false}>
      <button
        type="button"
        className={`${CHIP_CLASS} cursor-pointer transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand`}
        aria-label="选择本轮对话使用的知识库"
      >
        <Database className="size-3.5" aria-hidden="true" />
        <span className="shrink-0">知识库</span>
        <span className="shrink-0 text-ink-subtle" aria-hidden="true">
          ·
        </span>
        <span className="min-w-0 truncate text-ink-subtle">{summary}</span>
        <ChevronDown className="size-3 shrink-0 text-ink-subtle" aria-hidden="true" />
      </button>
    </Popover>
  );
}

export function KnowledgeBadge({ ids }: KnowledgeBadgeProps) {
  const items = useKnowledgeBases();
  const names = ids
    .map((id) => items.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const resolved = names.length === ids.length;

  if (ids.length === 0) {
    return (
      <span className={CHIP_CLASS}>
        <Database className="size-3.5" aria-hidden="true" />
        <span className="shrink-0">知识库</span>
        <span className="shrink-0 text-ink-subtle" aria-hidden="true">
          ·
        </span>
        <span className="text-ink-subtle">未启用</span>
      </span>
    );
  }

  const summary = resolved ? names.join('、') : `${ids.length} 个知识库`;

  return (
    <Tooltip title={`本会话启用：${summary}`}>
      <span className={`${CHIP_CLASS} cursor-default`}>
        <Database className="size-3.5" aria-hidden="true" />
        <span className="shrink-0">知识库</span>
        <span className="shrink-0 text-ink-subtle" aria-hidden="true">
          ·
        </span>
        <span className="min-w-0 truncate text-ink-subtle">{summary}</span>
      </span>
    </Tooltip>
  );
}
