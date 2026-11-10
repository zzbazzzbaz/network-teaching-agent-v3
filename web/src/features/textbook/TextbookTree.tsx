import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { toErrorMessage } from '@/api/client';
import { getMaterialTree } from '@/api/materials';
import type { MaterialCollectionTree, MaterialNodeSummary } from '@/api/types';
import { ErrorState } from '@/components/common';

interface TextbookTreeProps {
  onPick: (prompt: string) => void;
}

function chapterPrompt(collection: MaterialCollectionTree, chapter: MaterialNodeSummary): string {
  return `我想学习《${collection.title}》「${chapter.title}」。请先帮我梳理这一章的整体框架。`;
}

function sectionPrompt(collection: MaterialCollectionTree, section: MaterialNodeSummary): string {
  return `我想学习《${collection.title}》「${section.title}」。请结合教材给我讲解这一节。`;
}

function ChapterCard({
  chapter,
  collection,
  index,
  onPick,
}: {
  chapter: MaterialNodeSummary;
  collection: MaterialCollectionTree;
  index: number;
  onPick: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sections = chapter.children.filter((node) => node.kind === 'document');

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong">
      <button
        type="button"
        onClick={() => onPick(chapterPrompt(collection, chapter))}
        className="group flex flex-1 items-start gap-2.5 p-3.5 text-left transition-colors hover:bg-surface-sunken/60"
      >
        <span className="mt-0.5 font-code text-[10px] tabular-nums text-ink-subtle">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink">{chapter.title}</span>
        </span>
        <ArrowUpRight
          className="mt-0.5 size-3.5 shrink-0 text-ink-subtle transition-colors group-hover:text-brand"
          aria-hidden="true"
        />
      </button>

      {sections.length > 0 ? (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex w-full items-center justify-between px-3.5 py-1.5 text-[11px] text-ink-muted transition-colors hover:text-ink"
          >
            从某一节开始
            <ChevronDown
              className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {open ? (
            <ul className="px-1.5 pb-1.5">
              {sections.map((section) => {
                const code = section.title.split(' ')[0];
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => onPick(sectionPrompt(collection, section))}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
                    >
                      <span className="w-10 shrink-0 font-code text-[10px] tabular-nums text-ink-subtle">
                        {code}
                      </span>
                      <span className="truncate">{section.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="h-[58px] animate-pulse rounded-card border border-line bg-surface-sunken" />
  );
}

export function TextbookTree({ onPick }: TextbookTreeProps) {
  const treeQuery = useQuery({
    queryKey: ['materials', 'tree'],
    queryFn: getMaterialTree,
    retry: false,
  });

  if (treeQuery.isLoading) {
    return (
      <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <CardSkeleton key={index} />
        ))}
      </ul>
    );
  }

  if (treeQuery.isError) {
    return (
      <ErrorState
        title="教材目录加载失败"
        message={toErrorMessage(treeQuery.error, '教材内容暂不可用')}
        onRetry={() => void treeQuery.refetch()}
        compact
      />
    );
  }

  const textbook = treeQuery.data?.items.find((item) => item.kind === 'textbook');
  const chapters =
    textbook?.children.filter((node) => node.kind === 'folder' && node.name !== 'figures') ?? [];

  if (!textbook || chapters.length === 0) {
    return <p className="m-0 text-[12.5px] text-ink-muted">教材内容还在准备中。</p>;
  }

  return (
    <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {chapters.map((chapter, index) => (
        <ChapterCard
          key={chapter.id}
          chapter={chapter}
          collection={textbook}
          index={index}
          onPick={onPick}
        />
      ))}
    </ul>
  );
}
