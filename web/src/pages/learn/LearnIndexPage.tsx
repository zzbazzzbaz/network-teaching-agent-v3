import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { getMaterialTree } from '@/api/materials';
import type { MaterialCollectionTree, MaterialNodeSummary } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';

function countDocuments(nodes: MaterialNodeSummary[]): number {
  return nodes.reduce(
    (total, node) => total + (node.kind === 'document' ? 1 : countDocuments(node.children)),
    0,
  );
}

function firstDocument(nodes: MaterialNodeSummary[]): MaterialNodeSummary | null {
  for (const node of nodes) {
    if (node.kind === 'document') {
      return node;
    }
    const nested = firstDocument(node.children);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function CollectionCard({ collection }: { collection: MaterialCollectionTree }) {
  const navigate = useNavigate();
  const first = firstDocument(collection.children);
  const documents = countDocuments(collection.children);
  const Icon = collection.kind === 'question_bank' ? GraduationCap : BookOpen;

  return (
    <button
      type="button"
      disabled={!first}
      onClick={() => {
        if (first) {
          navigate(`/learn/${first.id}`);
        }
      }}
      className="group flex h-full flex-col rounded-panel border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <span className="font-code text-[10px] tracking-[0.12em] text-ink-subtle uppercase">
          {collection.kind === 'question_bank' ? 'QUESTION BANK' : 'TEXTBOOK'}
        </span>
      </span>
      <span className="mt-5 block text-[17px] font-semibold tracking-[-0.01em] text-ink">
        {collection.title}
      </span>
      <span className="mt-2 block flex-1 text-[12.5px] leading-6 text-ink-muted">
        {collection.description || '从目录选择一篇文档开始阅读。'}
      </span>
      <span className="mt-5 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[11.5px] text-ink-subtle">{documents} 篇文档</span>
        <span className="flex items-center gap-1 text-[12px] font-medium text-brand">
          开始阅读
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

export function LearnIndexPage() {
  const treeQuery = useQuery({
    queryKey: ['materials', 'tree'],
    queryFn: getMaterialTree,
    retry: false,
  });

  return (
    <PageShell>
      <header className="border-b border-line pb-5">
        <p className="m-0 eyebrow">COURSE LIBRARY</p>
        <h1 className="mt-1.5 mb-0 text-[24px] leading-tight font-semibold tracking-[-0.014em] text-ink">
          课程内容
        </h1>
        <p className="mt-2 mb-0 max-w-[62ch] text-[13px] leading-6 text-ink-muted">
          按章节阅读教材原文与题库解析，遇到不懂的内容可以直接带着当前小节进入对话。
        </p>
      </header>

      {treeQuery.isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="h-[190px] animate-pulse rounded-panel border border-line bg-surface-sunken"
            />
          ))}
        </div>
      ) : treeQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            title="课程内容加载失败"
            message={toErrorMessage(treeQuery.error, '内容服务暂不可用')}
            onRetry={() => void treeQuery.refetch()}
          />
        </div>
      ) : (treeQuery.data?.items.length ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState title="还没有课程内容" description="管理员导入教材后，这里会出现目录。" />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {treeQuery.data?.items.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
