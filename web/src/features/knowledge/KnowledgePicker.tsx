import { BookOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Select } from 'antd';

import { listKnowledgeBases } from '@/api/knowledge';

export interface KnowledgePickerProps {
  value: string[] | null;
  onChange: (ids: string[]) => void;
}

export function KnowledgePicker({ value, onChange }: KnowledgePickerProps) {
  const query = useQuery({
    queryKey: ['knowledge-bases', 'mine', undefined],
    queryFn: () => listKnowledgeBases('mine'),
    retry: false,
    staleTime: 30_000,
  });

  const items = query.data?.items ?? [];
  if (query.isLoading || items.length === 0) {
    return null;
  }

  const selected = value ?? items.map((item) => item.id);

  return (
    <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-subtle">
      <BookOutlined aria-hidden="true" />
      <span className="shrink-0">知识库</span>
      <Select
        mode="multiple"
        size="small"
        className="min-w-0 flex-1"
        maxTagCount="responsive"
        value={selected}
        onChange={(next) => onChange(next)}
        placeholder="选择本轮对话使用的知识库"
        options={items.map((item) => ({
          value: item.id,
          label: `${item.visibility === 'public' ? '[公共]' : '[私人]'} ${item.name}`,
        }))}
      />
    </div>
  );
}
