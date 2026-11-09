import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Drawer,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Download, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { toErrorMessage } from '@/api/client';
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  downloadKnowledgeDocument,
  listKnowledgeBases,
  listKnowledgeDocuments,
  updateKnowledgeBase,
  uploadKnowledgeDocument,
} from '@/api/knowledge';
import type { KnowledgeScope } from '@/api/knowledge';
import type {
  KnowledgeBaseItem,
  KnowledgeDocumentItem,
  KnowledgeDocumentStatus,
} from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common';
import { formatBytes, formatDateTime, formatNumber } from '@/lib/format';

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.md', '.txt', '.html'];

const DOC_STATUS: Record<
  KnowledgeDocumentStatus,
  { label: string; color: string; active: boolean }
> = {
  pending: { label: '等待处理', color: 'default', active: true },
  parsing: { label: '解析中', color: 'processing', active: true },
  chunking: { label: '切分中', color: 'processing', active: true },
  indexing: { label: '索引中', color: 'processing', active: true },
  ready: { label: '已就绪', color: 'success', active: false },
  error: { label: '失败', color: 'error', active: false },
};

export interface KnowledgePanelProps {
  scope: KnowledgeScope;
  userId?: string;
  visibility?: 'all' | 'private' | 'public';
  canCreate?: boolean;
  canEdit?: boolean;
  canUpload?: boolean;
  toolbar?: ReactNode;
}

export function KnowledgePanel({
  scope,
  userId,
  visibility = 'all',
  canCreate = false,
  canEdit = false,
  canUpload = false,
  toolbar,
}: KnowledgePanelProps) {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<KnowledgeBaseItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<KnowledgeBaseItem | null>(null);
  const [uploading, setUploading] = useState(false);

  const listKey = ['knowledge-bases', scope, userId] as const;
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => listKnowledgeBases(scope, userId),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      const active = data?.items.some((item) =>
        Object.entries(item.status_counts).some(
          ([status, count]) => status !== 'ready' && status !== 'error' && count > 0,
        ),
      );
      return active ? 3000 : false;
    },
  });

  const items = (listQuery.data?.items ?? []).filter(
    (item) => visibility === 'all' || item.visibility === visibility,
  );

  const documentKey = ['knowledge-documents', scope, userId, selected?.id] as const;
  const documentsQuery = useQuery({
    queryKey: documentKey,
    queryFn: () => listKnowledgeDocuments(scope, selected?.id as string, userId),
    enabled: Boolean(selected?.id),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      const active = data?.items.some((item) => DOC_STATUS[item.status].active);
      return active ? 2000 : false;
    },
  });

  const refreshList = () => {
    void queryClient.invalidateQueries({ queryKey: listKey });
  };

  const refreshDocuments = () => {
    void queryClient.invalidateQueries({ queryKey: documentKey });
    refreshList();
  };

  const openCreate = () => {
    setCreateName('');
    setCreateDescription('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      message.warning('请输入知识库名称');
      return;
    }
    setCreating(true);
    try {
      await createKnowledgeBase(
        scope,
        { name, description: createDescription.trim() },
        userId,
      );
      message.success('知识库已创建');
      setCreateOpen(false);
      refreshList();
    } catch (error) {
      message.error(toErrorMessage(error, '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (item: KnowledgeBaseItem) => {
    setEditing(item);
    setEditName(item.name);
    setEditDescription(item.description);
  };

  const submitEdit = async () => {
    if (!editing) {
      return;
    }
    const name = editName.trim();
    if (!name) {
      message.warning('请输入知识库名称');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateKnowledgeBase(
        scope,
        editing.id,
        { name, description: editDescription.trim() },
        userId,
      );
      message.success('已保存');
      setEditing(null);
      if (selected?.id === updated.id) {
        setSelected(updated);
      }
      refreshList();
    } catch (error) {
      message.error(toErrorMessage(error, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: KnowledgeBaseItem) => {
    modal.confirm({
      title: `删除知识库「${item.name}」？`,
      content: '知识库中的文档、索引和原始文件都会一并删除，且不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteKnowledgeBase(scope, item.id, userId);
          message.success('知识库已删除');
          if (selected?.id === item.id) {
            setSelected(null);
          }
          refreshList();
        } catch (error) {
          message.error(toErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  const handleUpload = async (file: File) => {
    if (!selected) {
      return;
    }
    const suffix = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!ACCEPTED_EXTENSIONS.includes(suffix)) {
      message.error('不支持的文件类型');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      message.error('文件过大，最大 30MB');
      return;
    }
    setUploading(true);
    try {
      await uploadKnowledgeDocument(scope, selected.id, file, userId);
      message.success('已上传，正在建立索引');
      refreshDocuments();
    } catch (error) {
      message.error(toErrorMessage(error, '上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteDocument = (document: KnowledgeDocumentItem) => {
    if (!selected) {
      return;
    }
    modal.confirm({
      title: `删除文档「${document.filename}」？`,
      content: '文档及其索引会被删除，且不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteKnowledgeDocument(scope, selected.id, document.id, userId);
          message.success('文档已删除');
          refreshDocuments();
        } catch (error) {
          message.error(toErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  const downloadDocument = async (document: KnowledgeDocumentItem) => {
    if (!selected) {
      return;
    }
    try {
      await downloadKnowledgeDocument(
        scope,
        selected.id,
        document.id,
        document.filename,
        userId,
      );
    } catch (error) {
      message.error(toErrorMessage(error, '下载失败'));
    }
  };

  const baseColumns: ColumnsType<KnowledgeBaseItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, record) => (
        <div className="min-w-0">
          <Typography.Text strong className="block truncate">
            {name}
          </Typography.Text>
          <Typography.Text type="secondary" className="block truncate text-xs">
            {record.description || '暂无描述'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '文档',
      dataIndex: 'document_count',
      width: 80,
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '片段',
      dataIndex: 'chunk_count',
      width: 90,
      responsive: ['lg'],
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status_counts',
      width: 120,
      render: (_value, record) => <StatusSummary item={record} />,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      responsive: ['xl'],
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
  ];

  if (canEdit) {
    baseColumns.push({
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_value, record) => (
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          <Button
            size="small"
            type="link"
            icon={<Pencil className="size-3.5" />}
            aria-label="编辑"
            onClick={() => openEdit(record)}
          />
          <Button
            size="small"
            type="link"
            danger
            icon={<Trash2 className="size-3.5" />}
            aria-label="删除"
            onClick={() => confirmDelete(record)}
          />
        </Space>
      ),
    });
  }

  const documentColumns: ColumnsType<KnowledgeDocumentItem> = [
    {
      title: '文件名',
      dataIndex: 'filename',
      ellipsis: true,
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (value: number) => <span className="data-text">{formatBytes(value)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (value: KnowledgeDocumentStatus, record) => (
        <div>
          <Tag color={DOC_STATUS[value].color}>{DOC_STATUS[value].label}</Tag>
          {record.error ? (
            <Typography.Text type="danger" className="mt-1 block text-xs">
              {record.error}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '片段',
      dataIndex: 'chunk_count',
      width: 80,
      render: (value: number) => <span className="data-text">{formatNumber(value)}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      responsive: ['lg'],
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      render: (_value, record) => (
        <Space size={4}>
          <Button
            size="small"
            type="link"
            icon={<Download className="size-3.5" />}
            aria-label="下载"
            onClick={() => void downloadDocument(record)}
          />
          {canUpload ? (
            <Button
              size="small"
              type="link"
              danger
              icon={<Trash2 className="size-3.5" />}
              aria-label="删除"
              onClick={() => confirmDeleteDocument(record)}
            />
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[767px]:flex-col max-[767px]:items-stretch">
        {toolbar ?? (
          <Typography.Text type="secondary">
            共 {formatNumber(items.length)} 个知识库
          </Typography.Text>
        )}
        {canCreate ? (
          <Button type="primary" icon={<Plus className="size-3.5" />} onClick={openCreate}>
            新建知识库
          </Button>
        ) : null}
      </div>

      {listQuery.isLoading ? (
        <Table loading columns={baseColumns} dataSource={[]} pagination={false} />
      ) : listQuery.isError ? (
        <ErrorState
          title="知识库加载失败"
          message={toErrorMessage(listQuery.error, '知识库服务暂不可用')}
          onRetry={() => void listQuery.refetch()}
          compact
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="还没有知识库"
          description={canCreate ? '新建一个知识库，上传资料后即可在对话中检索。' : '暂无内容'}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <Table
            rowKey="id"
            columns={baseColumns}
            dataSource={items}
            pagination={false}
            className="bg-surface"
            onRow={(record) => ({
              onClick: () => setSelected(record),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      )}

      <Modal
        open={createOpen}
        title="新建知识库"
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
        destroyOnHidden
      >
        <div className="space-y-3 pt-2">
          <Input
            value={createName}
            maxLength={100}
            placeholder="知识库名称"
            onChange={(event) => setCreateName(event.target.value)}
          />
          <Input.TextArea
            value={createDescription}
            maxLength={500}
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder="描述（可选）"
            onChange={(event) => setCreateDescription(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="编辑知识库"
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onCancel={() => setEditing(null)}
        onOk={() => void submitEdit()}
        destroyOnHidden
      >
        <div className="space-y-3 pt-2">
          <Input
            value={editName}
            maxLength={100}
            placeholder="知识库名称"
            onChange={(event) => setEditName(event.target.value)}
          />
          <Input.TextArea
            value={editDescription}
            maxLength={500}
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder="描述（可选）"
            onChange={(event) => setEditDescription(event.target.value)}
          />
        </div>
      </Modal>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size={760}
        title={selected?.name ?? '知识库'}
        destroyOnHidden
        extra={
          canUpload && selected?.editable ? (
            <Upload
              showUploadList={false}
              accept={ACCEPTED_EXTENSIONS.join(',')}
              beforeUpload={(file) => {
                void handleUpload(file as unknown as File);
                return Upload.LIST_IGNORE;
              }}
            >
              <Button icon={<UploadCloud className="size-3.5" />} loading={uploading}>
                上传文档
              </Button>
            </Upload>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-surface-sunken px-4 py-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-muted">
                <span>文档 {formatNumber(selected.document_count)}</span>
                <span>片段 {formatNumber(selected.chunk_count)}</span>
                <span>创建 {formatDateTime(selected.created_at)}</span>
              </div>
              {selected.description ? (
                <p className="mt-2 mb-0 text-[13px] text-ink-muted">{selected.description}</p>
              ) : null}
            </div>

            {documentsQuery.isLoading ? (
              <Table loading columns={documentColumns} dataSource={[]} pagination={false} />
            ) : documentsQuery.isError ? (
              <ErrorState
                title="文档加载失败"
                message={toErrorMessage(documentsQuery.error, '文档列表暂不可用')}
                onRetry={() => void documentsQuery.refetch()}
                compact
              />
            ) : (documentsQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="还没有文档"
                description={canUpload ? '支持 PDF、Word、PPT、Markdown、TXT、HTML。' : '暂无文档'}
              />
            ) : (
              <Table
                rowKey="id"
                columns={documentColumns}
                dataSource={documentsQuery.data?.items ?? []}
                pagination={false}
                size="small"
              />
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function StatusSummary({ item }: { item: KnowledgeBaseItem }) {
  const counts = item.status_counts;
  const processing = counts.pending + counts.parsing + counts.chunking + counts.indexing;
  if (counts.error > 0) {
    return <Tag color="error">{counts.error} 个失败</Tag>;
  }
  if (processing > 0) {
    return <Tag color="processing">{processing} 个处理中</Tag>;
  }
  if (counts.ready > 0) {
    return <Tag color="success">已就绪</Tag>;
  }
  return <Tag>无文档</Tag>;
}
