import { useQuery } from '@tanstack/react-query';
import { Button, Drawer } from 'antd';
import { ArrowLeft, ArrowRight, ListTree, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ApiError, toErrorMessage } from '@/api/client';
import { getMaterialNode, getMaterialTree } from '@/api/materials';
import type { MaterialCollectionTree, MaterialNodeDetail, MaterialNodeSummary } from '@/api/types';
import { EmptyState, ErrorState, PageLoading } from '@/components/common';
import { Markdown } from '@/features/chat';
import {
  MaterialTreeNav,
  buildImagePrompt,
  buildNodePrompt,
  materialChatHref,
} from '@/features/materials';

function findNode(
  items: MaterialCollectionTree[],
  nodeId: string,
): { node: MaterialNodeSummary; collection: MaterialCollectionTree } | null {
  const visit = (
    nodes: MaterialNodeSummary[],
    collection: MaterialCollectionTree,
  ): MaterialNodeSummary | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      const nested = visit(node.children, collection);
      if (nested) {
        return nested;
      }
    }
    return null;
  };
  for (const collection of items) {
    const node = visit(collection.children, collection);
    if (node) {
      return { node, collection };
    }
  }
  return null;
}

function imageFilename(src: string, alt: string, detail: MaterialNodeDetail): string {
  const direct = detail.images.find((image) => image.url === src);
  if (direct) {
    return direct.name;
  }
  const match = src.match(/([0-9a-fA-F-]{36})(?:\.[A-Za-z0-9]+)?$/);
  if (match) {
    const asset = detail.images.find((image) => image.file_id === match[1]);
    if (asset) {
      return asset.name;
    }
  }
  return alt || '这张图';
}

export function LearnPage() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const articleRef = useRef<HTMLDivElement | null>(null);

  const treeQuery = useQuery({
    queryKey: ['materials', 'tree'],
    queryFn: getMaterialTree,
    retry: false,
  });
  const nodeQuery = useQuery({
    queryKey: ['materials', 'node', nodeId],
    queryFn: () => getMaterialNode(nodeId as string),
    enabled: Boolean(nodeId),
    retry: false,
  });

  const detail = nodeQuery.data;
  const tree = treeQuery.data?.items ?? [];
  const current = useMemo(() => (nodeId ? findNode(tree, nodeId) : null), [tree, nodeId]);

  useEffect(() => {
    setSelectedText('');
  }, [nodeId]);

  const askWithPrompt = (prompt: string) => {
    if (!detail) {
      return;
    }
    navigate(materialChatHref(detail, prompt));
  };

  const handleImageAction = ({ src, alt }: { src: string; alt: string }) => {
    if (!detail) {
      return;
    }
    askWithPrompt(buildImagePrompt(detail, imageFilename(src, alt, detail)));
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!text || !articleRef.current) {
      setSelectedText('');
      return;
    }
    const anchor = selection?.anchorNode;
    if (anchor && articleRef.current.contains(anchor)) {
      setSelectedText(text);
    }
  };

  const notFound = nodeQuery.error instanceof ApiError && nodeQuery.error.status === 404;

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-2 pb-3">
        <span className="eyebrow">CONTENTS</span>
        <Button type="text" size="small" className="lg:hidden" onClick={() => setDrawerOpen(false)}>
          关闭
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {treeQuery.isLoading ? (
          <div className="space-y-2 px-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-8 animate-pulse rounded-md bg-surface-sunken" />
            ))}
          </div>
        ) : treeQuery.isError ? (
          <p className="px-2 text-[12px] text-ink-muted">
            {toErrorMessage(treeQuery.error, '目录加载失败')}
          </p>
        ) : (
          <MaterialTreeNav
            items={tree}
            activeNodeId={nodeId}
            onSelect={(node) => {
              navigate(`/learn/${node.id}`);
              setDrawerOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-[292px] shrink-0 border-r border-line bg-sidebar px-3 pt-4 lg:flex lg:flex-col">
        {sidebar}
      </aside>

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={310}
        closable={false}
        styles={{ body: { padding: '16px 12px' } }}
      >
        {sidebar}
      </Drawer>

      <div className="min-w-0 flex-1 overflow-y-auto bg-surface">
        {nodeQuery.isLoading ? (
          <PageLoading text="正在加载内容" />
        ) : notFound ? (
          <div className="mx-auto w-full max-w-[720px] px-6 py-16">
            <EmptyState
              title="内容不存在"
              description="它可能已被删除，或链接已经失效。"
              action={
                <Button type="primary" onClick={() => navigate('/learn')}>
                  返回课程内容
                </Button>
              }
            />
          </div>
        ) : nodeQuery.isError ? (
          <div className="mx-auto w-full max-w-[720px] px-6 py-16">
            <ErrorState
              title="内容加载失败"
              message={toErrorMessage(nodeQuery.error, '内容服务暂不可用')}
              onRetry={() => void nodeQuery.refetch()}
            />
          </div>
        ) : detail ? (
          <article className="mx-auto w-full max-w-[920px] px-5 pt-5 pb-16 sm:px-8">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Button
                    type="text"
                    size="small"
                    className="-ml-2 lg:hidden"
                    icon={<ListTree className="size-4" />}
                    onClick={() => setDrawerOpen(true)}
                    aria-label="打开目录"
                  />
                  <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[11.5px] text-ink-subtle">
                    <button
                      type="button"
                      onClick={() => navigate('/learn')}
                      className="truncate transition-colors hover:text-brand"
                    >
                      {detail.collection.title}
                    </button>
                    {detail.breadcrumbs
                      .filter((item) => item.kind === 'folder')
                      .map((item) => (
                        <span key={item.id} className="flex min-w-0 items-center gap-1">
                          <span aria-hidden="true">/</span>
                          <span className="truncate">{item.title}</span>
                        </span>
                      ))}
                    <span aria-hidden="true">/</span>
                    <span className="truncate text-ink-muted">{detail.title}</span>
                  </nav>
                </div>
                <h1 className="mt-2 mb-0 text-[24px] leading-tight font-semibold tracking-[-0.014em] text-ink">
                  {detail.title}
                </h1>
              </div>
              {detail.kind === 'document' ? (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    type="primary"
                    icon={<Sparkles className="size-3.5" />}
                    onClick={() => askWithPrompt(buildNodePrompt(detail))}
                  >
                    问 AI 这一节
                  </Button>
                  {selectedText ? (
                    <Button
                      size="small"
                      onClick={() => askWithPrompt(buildNodePrompt(detail, selectedText))}
                    >
                      问 AI 选中内容
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {detail.kind === 'folder' ? (
              <FolderChildren
                nodes={current?.node.children ?? []}
                onOpen={(id) => navigate(`/learn/${id}`)}
              />
            ) : (
              <>
                <div
                  ref={articleRef}
                  onMouseUp={handleSelection}
                  onKeyUp={handleSelection}
                  className="pt-5"
                >
                  <Markdown
                    content={detail.content ?? ''}
                    imageMaxWidth={780}
                    onImageAction={handleImageAction}
                  />
                </div>

                <nav className="mt-10 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
                  {detail.prev ? (
                    <Button
                      className="h-auto justify-start py-2.5 text-left"
                      onClick={() => navigate(`/learn/${detail.prev?.id}`)}
                    >
                      <span className="flex min-w-0 flex-col items-start">
                        <span className="text-[10.5px] text-ink-subtle">上一篇</span>
                        <span className="flex w-full items-center gap-1.5">
                          <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{detail.prev.title}</span>
                        </span>
                      </span>
                    </Button>
                  ) : (
                    <span />
                  )}
                  {detail.next ? (
                    <Button
                      className="h-auto justify-end py-2.5 text-right"
                      onClick={() => navigate(`/learn/${detail.next?.id}`)}
                    >
                      <span className="flex min-w-0 flex-col items-end">
                        <span className="text-[10.5px] text-ink-subtle">下一篇</span>
                        <span className="flex w-full items-center justify-end gap-1.5">
                          <span className="truncate">{detail.next.title}</span>
                          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                        </span>
                      </span>
                    </Button>
                  ) : null}
                </nav>
              </>
            )}
          </article>
        ) : null}
      </div>
    </div>
  );
}

function FolderChildren({
  nodes,
  onOpen,
}: {
  nodes: MaterialNodeSummary[];
  onOpen: (nodeId: string) => void;
}) {
  if (nodes.length === 0) {
    return (
      <div className="pt-8">
        <EmptyState title="空目录" description="这个目录下还没有内容。" />
      </div>
    );
  }
  return (
    <ul className="mt-6 grid list-none gap-2 p-0 sm:grid-cols-2">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onOpen(node.id)}
            className="w-full rounded-card border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-sunken/60"
          >
            <span className="block text-[13px] font-medium text-ink">{node.title}</span>
            <span className="mt-1 block truncate font-code text-[10px] text-ink-subtle">
              {node.kind === 'folder' ? '目录' : node.path}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
