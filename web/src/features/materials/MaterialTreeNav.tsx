import { BookOpen, ChevronRight, FileText, Folder, GraduationCap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { MaterialCollectionTree, MaterialNodeSummary } from '@/api/types';

function findAncestors(items: MaterialCollectionTree[], activeNodeId: string): string[] {
  const path: string[] = [];
  const visit = (
    nodes: MaterialNodeSummary[],
    collectionId: string,
    ancestors: string[],
  ): boolean => {
    for (const node of nodes) {
      if (node.id === activeNodeId) {
        path.push(collectionId, ...ancestors);
        return true;
      }
      if (node.children.length > 0 && visit(node.children, collectionId, [...ancestors, node.id])) {
        return true;
      }
    }
    return false;
  };
  for (const collection of items) {
    if (visit(collection.children, collection.id, [])) {
      return path;
    }
  }
  return [];
}

interface MaterialTreeNavProps {
  items: MaterialCollectionTree[];
  activeNodeId?: string | null;
  onSelect: (node: MaterialNodeSummary, collection: MaterialCollectionTree) => void;
}

export function MaterialTreeNav({ items, activeNodeId, onSelect }: MaterialTreeNavProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const ancestors = useMemo(
    () => (activeNodeId ? findAncestors(items, activeNodeId) : []),
    [items, activeNodeId],
  );

  useEffect(() => {
    if (ancestors.length === 0) {
      return;
    }
    setExpanded((current) => {
      const next = new Set(current);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
  }, [ancestors]);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (items.length === 0) {
    return <p className="px-2 py-6 text-[12px] text-ink-muted">暂无内容</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="课程目录">
      {items.map((collection) => {
        const open = expanded.has(collection.id);
        const Icon = collection.kind === 'question_bank' ? GraduationCap : BookOpen;
        return (
          <li key={collection.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(collection.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-sunken"
            >
              <Icon className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                {collection.title}
              </span>
              <ChevronRight
                className={`size-3.5 shrink-0 text-ink-subtle transition-transform ${open ? 'rotate-90' : ''}`}
                aria-hidden="true"
              />
            </button>
            {open ? (
              <NodeList
                nodes={collection.children}
                collection={collection}
                depth={1}
                expanded={expanded}
                activeNodeId={activeNodeId}
                onToggle={toggle}
                onSelect={onSelect}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function NodeList({
  nodes,
  collection,
  depth,
  expanded,
  activeNodeId,
  onToggle,
  onSelect,
}: {
  nodes: MaterialNodeSummary[];
  collection: MaterialCollectionTree;
  depth: number;
  expanded: Set<string>;
  activeNodeId?: string | null;
  onToggle: (id: string) => void;
  onSelect: (node: MaterialNodeSummary, collection: MaterialCollectionTree) => void;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((node) => {
        const isFolder = node.kind === 'folder';
        const open = expanded.has(node.id);
        const active = node.id === activeNodeId;
        return (
          <li key={node.id}>
            <button
              type="button"
              aria-expanded={isFolder ? open : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (isFolder) {
                  onToggle(node.id);
                } else {
                  onSelect(node, collection);
                }
              }}
              style={{ paddingLeft: `${10 + depth * 12}px` }}
              className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors ${
                active
                  ? 'bg-brand-soft text-brand-strong'
                  : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              {isFolder ? (
                <>
                  <ChevronRight
                    className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                    aria-hidden="true"
                  />
                  <Folder className="size-3.5 shrink-0" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span className="w-3 shrink-0" aria-hidden="true" />
                  <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                </>
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] leading-5">{node.title}</span>
            </button>
            {isFolder && open && node.children.length > 0 ? (
              <NodeList
                nodes={node.children}
                collection={collection}
                depth={depth + 1}
                expanded={expanded}
                activeNodeId={activeNodeId}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
