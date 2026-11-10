import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, Modal, Select, Space, Tag, Tree, Upload } from 'antd';
import type { TreeProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import {
  BookOpen,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  GraduationCap,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';

import { toErrorMessage } from '@/api/client';
import {
  completeMaterialAssetUpload,
  createMaterialCollection,
  createMaterialNode,
  deleteMaterialCollection,
  deleteMaterialNode,
  getMaterialNode,
  getMaterialTree,
  requestMaterialAssetUploadUrl,
  reorderMaterialNodes,
  updateMaterialCollection,
  updateMaterialNode,
} from '@/api/materials';
import type {
  MaterialCollectionKind,
  MaterialCollectionTree,
  MaterialNodeSummary,
} from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common';
import { Markdown } from '@/features/chat';
import { putFileWithProgress } from '@/features/upload/put-file';

interface NodeRecord {
  kind: 'collection' | 'folder' | 'document';
  collectionId: string;
  parentId: string | null;
  collection: MaterialCollectionTree;
  node: MaterialNodeSummary | null;
}

function buildRecords(items: MaterialCollectionTree[]): Map<string, NodeRecord> {
  const records = new Map<string, NodeRecord>();
  const visit = (
    collection: MaterialCollectionTree,
    nodes: MaterialNodeSummary[],
    parentId: string | null,
  ) => {
    for (const node of nodes) {
      records.set(node.id, {
        kind: node.kind,
        collectionId: collection.id,
        parentId,
        collection,
        node,
      });
      visit(collection, node.children, node.id);
    }
  };
  for (const collection of items) {
    records.set(collection.id, {
      kind: 'collection',
      collectionId: collection.id,
      parentId: null,
      collection,
      node: null,
    });
    visit(collection, collection.children, null);
  }
  return records;
}

function findChildren(
  items: MaterialCollectionTree[],
  collectionId: string,
  parentId: string | null,
): MaterialNodeSummary[] {
  const collection = items.find((item) => item.id === collectionId);
  if (!collection) {
    return [];
  }
  if (parentId === null) {
    return collection.children;
  }
  const find = (nodes: MaterialNodeSummary[]): MaterialNodeSummary | null => {
    for (const node of nodes) {
      if (node.id === parentId) {
        return node;
      }
      const nested = find(node.children);
      if (nested) {
        return nested;
      }
    }
    return null;
  };
  return find(collection.children)?.children ?? [];
}

function titleNode(record: NodeRecord): ReactNode {
  if (record.kind === 'collection') {
    const Icon = record.collection.kind === 'question_bank' ? GraduationCap : BookOpen;
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
        <span className="truncate font-medium">{record.collection.title}</span>
      </span>
    );
  }
  const node = record.node as MaterialNodeSummary;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {node.kind === 'folder' ? (
        <Folder className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      ) : (
        <FileText className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      )}
      <span className="truncate">{node.title}</span>
    </span>
  );
}

function toTreeData(items: MaterialCollectionTree[], records: Map<string, NodeRecord>): DataNode[] {
  const visit = (node: MaterialNodeSummary): DataNode => ({
    key: node.id,
    isLeaf: node.kind === 'document',
    title: titleNode(records.get(node.id) as NodeRecord),
    children: node.kind === 'folder' ? node.children.map(visit) : undefined,
  });
  return items.map((collection) => ({
    key: collection.id,
    title: titleNode(records.get(collection.id) as NodeRecord),
    children: collection.children.map(visit),
  }));
}

export function AdminMaterialsPage() {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<TextAreaRef | null>(null);

  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionMode, setCollectionMode] = useState<'create' | 'edit'>('create');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<MaterialCollectionKind>('textbook');
  const [description, setDescription] = useState('');
  const [collectionSaving, setCollectionSaving] = useState(false);

  const [nodeModalKind, setNodeModalKind] = useState<'folder' | 'document' | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeSaving, setNodeSaving] = useState(false);

  const treeQuery = useQuery({
    queryKey: ['materials', 'tree'],
    queryFn: getMaterialTree,
    retry: false,
  });
  const items = treeQuery.data?.items ?? [];
  const records = useMemo(() => buildRecords(items), [items]);
  const activeCollection = items.find((item) => item.id === activeCollectionId) ?? null;
  const selectedRecord = selectedNodeId ? records.get(selectedNodeId) : null;
  const selectedNode = selectedRecord?.node ?? null;

  const nodeQuery = useQuery({
    queryKey: ['materials', 'node', selectedNodeId],
    queryFn: () => getMaterialNode(selectedNodeId as string),
    enabled: Boolean(selectedNodeId),
    retry: false,
  });
  const detail = nodeQuery.data;

  useEffect(() => {
    if (!detail) {
      return;
    }
    setName(detail.name);
    setContent(detail.content ?? '');
  }, [detail?.id, detail?.updated_at, detail?.name, detail?.content]);

  useEffect(() => {
    if (!activeCollectionId) {
      return;
    }
    setExpandedKeys((current) =>
      current.includes(activeCollectionId) ? current : [...current, activeCollectionId],
    );
  }, [activeCollectionId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['materials', 'tree'] });
    if (selectedNodeId) {
      void queryClient.invalidateQueries({ queryKey: ['materials', 'node', selectedNodeId] });
    }
  };

  const openCreateCollection = () => {
    setCollectionMode('create');
    setSlug('');
    setTitle('');
    setKind('textbook');
    setDescription('');
    setCollectionModalOpen(true);
  };

  const openEditCollection = () => {
    if (!activeCollection) {
      return;
    }
    setCollectionMode('edit');
    setSlug(activeCollection.slug);
    setTitle(activeCollection.title);
    setKind(activeCollection.kind);
    setDescription(activeCollection.description);
    setCollectionModalOpen(true);
  };

  const submitCollection = async () => {
    if (!title.trim()) {
      message.warning('请输入名称');
      return;
    }
    setCollectionSaving(true);
    try {
      if (collectionMode === 'create') {
        const created = await createMaterialCollection({
          slug: slug.trim(),
          title: title.trim(),
          kind,
          description: description.trim(),
        });
        setActiveCollectionId(created.id);
        setSelectedNodeId(null);
        message.success('已创建');
      } else if (activeCollection) {
        await updateMaterialCollection(activeCollection.id, {
          title: title.trim(),
          description: description.trim(),
        });
        message.success('已保存');
      }
      setCollectionModalOpen(false);
      invalidate();
    } catch (error) {
      message.error(toErrorMessage(error, '保存失败'));
    } finally {
      setCollectionSaving(false);
    }
  };

  const confirmDeleteCollection = () => {
    if (!activeCollection) {
      return;
    }
    modal.confirm({
      title: `删除「${activeCollection.title}」？`,
      content: '目录、文档和图片会一起从学生端移除，且不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMaterialCollection(activeCollection.id);
          setActiveCollectionId(null);
          setSelectedNodeId(null);
          message.success('已删除');
          invalidate();
        } catch (error) {
          message.error(toErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  const openCreateNode = (nodeKind: 'folder' | 'document') => {
    if (!activeCollectionId) {
      message.warning('请先选择教材或题库');
      return;
    }
    setNodeModalKind(nodeKind);
    setNodeName('');
  };

  const submitNode = async () => {
    if (!nodeModalKind || !activeCollectionId) {
      return;
    }
    if (!nodeName.trim()) {
      message.warning('请输入路径名');
      return;
    }
    const parentId =
      selectedNode?.kind === 'folder' ? selectedNode.id : (selectedNode?.parent_id ?? null);
    setNodeSaving(true);
    try {
      const created = await createMaterialNode({
        collection_id: activeCollectionId,
        parent_id: parentId,
        name: nodeName.trim(),
        content: nodeModalKind === 'document' ? '' : null,
      });
      setSelectedNodeId(created.id);
      setExpandedKeys((current) => {
        const next = new Set(current);
        next.add(activeCollectionId);
        if (parentId) {
          next.add(parentId);
        }
        return [...next];
      });
      setNodeModalKind(null);
      message.success('已创建');
      invalidate();
    } catch (error) {
      message.error(toErrorMessage(error, '创建失败'));
    } finally {
      setNodeSaving(false);
    }
  };

  const saveNode = async () => {
    if (!detail) {
      return;
    }
    if (!name.trim()) {
      message.warning('路径名不能为空');
      return;
    }
    setSaving(true);
    try {
      await updateMaterialNode(detail.id, {
        name: name.trim(),
        content: detail.kind === 'document' ? content : null,
      });
      message.success('已保存');
      invalidate();
      void nodeQuery.refetch();
    } catch (error) {
      message.error(toErrorMessage(error, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteNode = () => {
    if (!detail) {
      return;
    }
    modal.confirm({
      title: `删除「${detail.title}」？`,
      content: '子目录和文档会一起删除，图片资产保留，且内容不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMaterialNode(detail.id);
          setSelectedNodeId(null);
          message.success('已删除');
          invalidate();
        } catch (error) {
          message.error(toErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current?.resizableTextArea?.textArea;
    if (!textarea) {
      setContent((current) => `${current}${current ? '\n\n' : ''}${text}\n`);
      return;
    }
    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${text}${content.slice(end)}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const uploadImage = async (file: File) => {
    if (!detail || detail.kind !== 'document') {
      return;
    }
    setUploading(true);
    const controller = new AbortController();
    try {
      const ticket = await requestMaterialAssetUploadUrl(detail.id, file.name, file.size);
      await putFileWithProgress({
        url: ticket.upload_url,
        headers: ticket.headers,
        file,
        signal: controller.signal,
        onProgress: () => undefined,
      });
      const completed = await completeMaterialAssetUpload(ticket.file_id);
      insertAtCursor(completed.markdown);
      message.success('图片已插入');
    } catch (error) {
      message.error(toErrorMessage(error, '图片上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop: TreeProps['onDrop'] = (info) => {
    void (async () => {
      const dragKey = String(info.dragNode.key);
      const dropKey = String(info.node.key);
      const drag = records.get(dragKey);
      const drop = records.get(dropKey);
      if (!drag?.node || !drop) {
        return;
      }
      if (drag.kind === 'collection') {
        message.warning('暂不支持调整教材顺序');
        return;
      }
      if (drag.collectionId !== drop.collectionId) {
        message.warning('暂不支持跨教材移动');
        return;
      }
      let parentId: string | null;
      let siblings: MaterialNodeSummary[];
      let index: number;
      if (drop.node && info.dropToGap) {
        parentId = drop.parentId;
        siblings = findChildren(items, drag.collectionId, parentId);
        index = siblings.findIndex((node) => node.id === drop.node?.id);
        if ((info.dropPosition ?? 0) > 0) {
          index += 1;
        }
      } else if (drop.node?.kind === 'folder') {
        parentId = drop.node.id;
        siblings = drop.node.children;
        index = siblings.length;
      } else if (drop.node) {
        parentId = drop.parentId;
        siblings = findChildren(items, drag.collectionId, parentId);
        index = siblings.findIndex((node) => node.id === drop.node?.id) + 1;
      } else {
        parentId = null;
        siblings = findChildren(items, drag.collectionId, null);
        index = siblings.length;
      }
      if (siblings.length === 0) {
        siblings = findChildren(items, drag.collectionId, parentId);
      }
      const removeBefore = siblings
        .slice(0, Math.max(index, 0))
        .filter((node) => node.id === dragKey).length;
      const remaining = siblings.filter((node) => node.id !== dragKey);
      const targetIndex = Math.max(0, Math.min(index - removeBefore, remaining.length));
      const ordered = [...remaining];
      ordered.splice(targetIndex, 0, drag.node as MaterialNodeSummary);
      try {
        if (parentId !== drag.parentId) {
          await updateMaterialNode(dragKey, { parent_id: parentId });
        }
        await reorderMaterialNodes(
          ordered.map((node, position) => ({ id: node.id, sort_order: position })),
        );
        if (parentId) {
          setExpandedKeys((current) =>
            current.includes(parentId) ? current : [...current, parentId],
          );
        }
        message.success('已移动');
        invalidate();
      } catch (error) {
        message.error(toErrorMessage(error, '移动失败'));
      }
    })();
  };

  const treeData = useMemo(() => toTreeData(items, records), [items, records]);

  const parentRecord = selectedNode?.parent_id ? records.get(selectedNode.parent_id) : null;
  const nodeParentLabel = parentRecord?.node?.title ?? '根目录';
  const newNodeParentLabel = selectedNode?.kind === 'folder' ? selectedNode.title : nodeParentLabel;

  return (
    <div className="mx-auto min-h-0 w-full max-w-[1400px] flex-1 overflow-y-auto px-4 pt-4 pb-12 max-[767px]:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select
            className="min-w-[220px]"
            placeholder="选择教材或题库"
            value={activeCollectionId}
            options={items.map((item) => ({
              value: item.id,
              label: `${item.kind === 'question_bank' ? '题库' : '教材'} · ${item.title}`,
            }))}
            onChange={(value) => {
              setActiveCollectionId(value);
              setSelectedNodeId(null);
            }}
          />
          <Button icon={<Plus className="size-3.5" />} onClick={openCreateCollection}>
            新建教材/题库
          </Button>
          {activeCollection ? (
            <>
              <Button icon={<Pencil className="size-3.5" />} onClick={openEditCollection}>
                编辑
              </Button>
              <Button
                danger
                icon={<Trash2 className="size-3.5" />}
                onClick={confirmDeleteCollection}
              >
                删除
              </Button>
            </>
          ) : null}
        </div>
        <Space>
          <Button
            icon={<FolderPlus className="size-3.5" />}
            disabled={!activeCollectionId}
            onClick={() => openCreateNode('folder')}
          >
            新建目录
          </Button>
          <Button
            icon={<FilePlus className="size-3.5" />}
            disabled={!activeCollectionId}
            onClick={() => openCreateNode('document')}
          >
            新建文档
          </Button>
        </Space>
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-h-[240px] rounded-panel border border-line bg-surface p-2 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
          {treeQuery.isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="h-8 animate-pulse rounded-md bg-surface-sunken" />
              ))}
            </div>
          ) : treeQuery.isError ? (
            <ErrorState
              title="目录加载失败"
              message={toErrorMessage(treeQuery.error, '内容服务暂不可用')}
              onRetry={() => void treeQuery.refetch()}
              compact
            />
          ) : items.length === 0 ? (
            <EmptyState title="还没有内容" description="先新建一个教材或题库。" />
          ) : (
            <Tree
              blockNode
              draggable
              treeData={treeData}
              expandedKeys={expandedKeys}
              selectedKeys={
                selectedNodeId ? [selectedNodeId] : activeCollectionId ? [activeCollectionId] : []
              }
              onExpand={(keys) => setExpandedKeys(keys)}
              onSelect={(keys) => {
                const key = String(keys[0] ?? '');
                const record = records.get(key);
                if (!record) {
                  setSelectedNodeId(null);
                  return;
                }
                setActiveCollectionId(record.collectionId);
                setSelectedNodeId(record.node ? key : null);
                if (!expandedKeys.includes(key)) {
                  setExpandedKeys((current) => [...current, key]);
                }
              }}
              onDrop={handleDrop}
            />
          )}
        </div>

        <div className="min-w-0 rounded-panel border border-line bg-surface p-4">
          {!selectedNodeId ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center">
              <p className="m-0 text-[13px] text-ink-muted">
                从左侧选择一篇文档开始编辑，或新建目录/文档。
              </p>
              {activeCollection ? (
                <p className="m-0 font-code text-[10.5px] text-ink-subtle">
                  当前：{activeCollection.title}
                </p>
              ) : null}
            </div>
          ) : nodeQuery.isLoading ? (
            <p className="m-0 py-10 text-center text-[12px] text-ink-muted">正在加载节点…</p>
          ) : nodeQuery.isError ? (
            <ErrorState
              title="节点加载失败"
              message={toErrorMessage(nodeQuery.error, '节点暂不可用')}
              onRetry={() => void nodeQuery.refetch()}
              compact
            />
          ) : detail ? (
            <div className="flex min-h-0 flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag color={detail.kind === 'folder' ? 'default' : 'processing'}>
                      {detail.kind === 'folder' ? '目录' : '文档'}
                    </Tag>
                    <span className="font-code text-[10.5px] text-ink-subtle">{detail.path}</span>
                  </div>
                  <h2 className="mt-1.5 mb-0 truncate text-[17px] font-semibold text-ink">
                    {detail.title}
                  </h2>
                </div>
                <Space>
                  {detail.kind === 'document' ? (
                    <Upload
                      showUploadList={false}
                      accept="image/*"
                      beforeUpload={(file) => {
                        void uploadImage(file as unknown as File);
                        return Upload.LIST_IGNORE;
                      }}
                    >
                      <Button icon={<ImagePlus className="size-3.5" />} loading={uploading}>
                        插入图片
                      </Button>
                    </Upload>
                  ) : null}
                  <Button
                    type="primary"
                    icon={<Save className="size-3.5" />}
                    loading={saving}
                    onClick={() => void saveNode()}
                  >
                    保存
                  </Button>
                  <Button danger icon={<Trash2 className="size-3.5" />} onClick={confirmDeleteNode}>
                    删除
                  </Button>
                </Space>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-ink-muted">路径名（name，不含 .md）</span>
                <Input
                  value={name}
                  maxLength={255}
                  placeholder={
                    detail.kind === 'folder' ? '例如 05-运输层' : '例如 5.8.2-TCP的拥塞控制方法'
                  }
                  onChange={(event) => setName(event.target.value)}
                />
                <span className="text-[10.5px] text-ink-subtle">
                  显示标题由路径名自动生成；当前标题：{detail.title}
                </span>
              </label>

              {detail.kind === 'document' ? (
                <div className="grid min-h-0 gap-3 xl:grid-cols-2">
                  <div className="flex min-h-0 flex-col gap-1">
                    <span className="text-[11.5px] text-ink-muted">Markdown 正文</span>
                    <Input.TextArea
                      ref={textareaRef}
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      autoSize={{ minRows: 20, maxRows: 32 }}
                      spellCheck={false}
                      className="font-code text-[12.5px] leading-6"
                    />
                  </div>
                  <div className="min-h-0">
                    <span className="text-[11.5px] text-ink-muted">预览</span>
                    <div className="mt-1 max-h-[720px] overflow-y-auto rounded-card border border-line bg-surface px-4 py-3">
                      <Markdown content={content} imageMaxWidth={520} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-card border border-line bg-surface-sunken px-4 py-3 text-[12.5px] text-ink-muted">
                  这是目录，父级：{nodeParentLabel}。新建文档时如果选中这个目录，文档会放在它下面。
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        open={collectionModalOpen}
        title={collectionMode === 'create' ? '新建教材/题库' : '编辑教材/题库'}
        okText="保存"
        cancelText="取消"
        confirmLoading={collectionSaving}
        onCancel={() => setCollectionModalOpen(false)}
        onOk={() => void submitCollection()}
        destroyOnHidden
      >
        <div className="space-y-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-muted">slug</span>
            <Input
              value={slug}
              disabled={collectionMode === 'edit'}
              placeholder="例如 computer-networks-8e"
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-muted">名称</span>
            <Input
              value={title}
              placeholder="例如 计算机网络（第8版）"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-muted">类型</span>
            <Select
              value={kind}
              disabled={collectionMode === 'edit'}
              options={[
                { value: 'textbook', label: '教材（课程学习）' },
                { value: 'question_bank', label: '题库（考研备考）' },
              ]}
              onChange={(value) => setKind(value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-muted">描述</span>
            <Input.TextArea
              value={description}
              autoSize={{ minRows: 2, maxRows: 5 }}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={nodeModalKind !== null}
        title={nodeModalKind === 'folder' ? '新建目录' : '新建文档'}
        okText="创建"
        cancelText="取消"
        confirmLoading={nodeSaving}
        onCancel={() => setNodeModalKind(null)}
        onOk={() => void submitNode()}
        destroyOnHidden
      >
        <div className="pt-2">
          <Input
            value={nodeName}
            autoFocus
            maxLength={255}
            placeholder={
              nodeModalKind === 'folder' ? '例如 05-运输层' : '例如 5.8.2-TCP的拥塞控制方法'
            }
            onChange={(event) => setNodeName(event.target.value)}
          />
          <p className="mt-2 mb-0 text-[11px] text-ink-subtle">将创建在：{newNodeParentLabel}</p>
        </div>
      </Modal>
    </div>
  );
}
