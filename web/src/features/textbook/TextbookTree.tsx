import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { TEXTBOOK_TREE } from './textbook-tree';
import type { TextbookNode } from './types';

interface TextbookTreeProps {
  onPick: (prompt: string) => void;
}

function ChapterCard({
  chapter,
  index,
  onPick,
}: {
  chapter: TextbookNode;
  index: number;
  onPick: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sections = chapter.children.filter((node) => node.type === 'file');

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong">
      <button
        type="button"
        onClick={() => onPick(chapter.prompt)}
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
                  <li key={section.key}>
                    <button
                      type="button"
                      onClick={() => onPick(section.prompt)}
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

export function TextbookTree({ onPick }: TextbookTreeProps) {
  return (
    <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {TEXTBOOK_TREE.map((chapter, index) => (
        <ChapterCard key={chapter.key} chapter={chapter} index={index} onPick={onPick} />
      ))}
    </ul>
  );
}
