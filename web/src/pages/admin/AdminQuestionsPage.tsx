import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DatePicker,
  Input,
  List,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { listQuestions, listUsers } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { AdminQuestionItem, AdminQuestionScope, QuestionType } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { QuestionFormModal } from '@/features/admin/QuestionFormModal';
import { formatDateTime, truncate } from '@/lib/format';
import { useIsMobile } from '@/lib/use-media-query';

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '单选',
  short_answer: '简答',
};

function parseScope(value: string | null): AdminQuestionScope {
  return value === 'public' || value === 'user' ? value : 'all';
}

function parseType(value: string | null): QuestionType | undefined {
  return value === 'single_choice' || value === 'short_answer' ? value : undefined;
}

export function AdminQuestionsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = parseScope(searchParams.get('scope'));
  const userId = searchParams.get('user') ?? '';
  const questionType = parseType(searchParams.get('type'));
  const query = searchParams.get('q') ?? '';
  const date = searchParams.get('date') ?? '';
  const page = Math.max(Number(searchParams.get('page') ?? '1'), 1);

  const [keyword, setKeyword] = useState(query);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setKeyword(query);
  }, [query]);

  useEffect(() => {
    if (keyword === query) {
      return;
    }
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (keyword) {
        next.set('q', keyword);
      } else {
        next.delete('q');
      }
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, query, searchParams, setSearchParams]);

  const studentsQuery = useQuery({
    queryKey: ['admin-users', 'student-options'],
    queryFn: () => listUsers({ role: 'student', limit: 100, offset: 0, sort: 'username_asc' }),
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ['admin-questions', { scope, userId, questionType, query, date, page }],
    queryFn: () =>
      listQuestions({
        scope,
        user_id: scope === 'user' ? userId : undefined,
        q: query || undefined,
        question_type: questionType,
        date: date || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    enabled: scope !== 'user' || Boolean(userId),
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    if (key === 'scope' && value !== 'user') {
      next.delete('user');
    }
    setSearchParams(next, { replace: true });
  };

  const columns: ColumnsType<AdminQuestionItem> = [
    {
      title: '题干',
      dataIndex: 'stem',
      render: (stem: string, record) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm text-ink hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => navigate(`/admin/questions/${record.id}`)}
        >
          {truncate(stem, 80)}
        </button>
      ),
    },
    {
      title: '来源',
      dataIndex: 'owner_username',
      width: 110,
      render: (_value, record) => (
        <Tag color={record.is_public ? 'blue' : 'default'}>
          {record.is_public ? '公共' : record.owner_username}
        </Tag>
      ),
    },
    {
      title: '题型',
      dataIndex: 'question_type',
      width: 80,
      render: (value: QuestionType) => <Tag>{TYPE_LABELS[value]}</Tag>,
    },
    {
      title: '作答次数',
      dataIndex: 'attempt_count',
      width: 100,
      align: 'right',
      render: (value: number) => <span className="data-text">{value}</span>,
    },
    {
      title: '学生数',
      dataIndex: 'student_count',
      width: 90,
      align: 'right',
      responsive: ['lg'],
      render: (value: number) => <span className="data-text">{value}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      responsive: ['xl'],
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
  ];

  const data = listQuery.data;

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[767px]:flex-col max-[767px]:items-stretch">
        <div className="flex flex-wrap items-center gap-2 max-[767px]:flex-col max-[767px]:items-stretch">
          <Segmented
            value={scope}
            onChange={(value) => updateParam('scope', value === 'all' ? null : String(value))}
            options={[
              { label: '全部', value: 'all' },
              { label: '公共', value: 'public' },
              { label: '指定学生', value: 'user' },
            ]}
          />
          {scope === 'user' ? (
            <Select
              className="w-[180px] max-[767px]:w-full"
              placeholder="选择学生"
              showSearch
              optionFilterProp="label"
              value={userId || undefined}
              onChange={(value) => updateParam('user', value ?? null)}
              options={(studentsQuery.data?.items ?? []).map((item) => ({
                label: item.username,
                value: item.id,
              }))}
            />
          ) : null}
          <Select
            allowClear
            className="w-[130px] max-[767px]:w-full"
            placeholder="全部题型"
            value={questionType}
            onChange={(value) => updateParam('type', value ?? null)}
            options={[
              { label: '单选题', value: 'single_choice' },
              { label: '简答题', value: 'short_answer' },
            ]}
          />
          <DatePicker
            allowClear
            placeholder="按日期筛选"
            value={date ? dayjs(date) : null}
            onChange={(value) => updateParam('date', value ? value.format('YYYY-MM-DD') : null)}
          />
          <Input.Search
            allowClear
            className="w-[220px] max-[767px]:w-full"
            placeholder="搜索题干"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
          新建公共题
        </Button>
      </div>

      {scope === 'user' && !userId ? (
        <EmptyState title="请选择学生" description="选择一名学生后查看其私有题目。" />
      ) : listQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : listQuery.isError ? (
        <ErrorState
          title="题目列表加载失败"
          message={toErrorMessage(listQuery.error, '请稍后重试')}
          onRetry={() => void listQuery.refetch()}
          compact
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="没有匹配的题目"
          description="调整筛选条件，或新建一道公共题。"
          action={<Button onClick={() => setFormOpen(true)}>新建公共题</Button>}
        />
      ) : isMobile ? (
        <List
          className="overflow-hidden rounded-card border border-line bg-surface"
          dataSource={data.items}
          rowKey="id"
          renderItem={(item) => (
            <List.Item
              onClick={() => navigate(`/admin/questions/${item.id}`)}
              className="cursor-pointer"
              style={{ padding: '12px 16px' }}
            >
              <div className="w-full">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Tag color={item.is_public ? 'blue' : 'default'}>
                    {item.is_public ? '公共' : item.owner_username}
                  </Tag>
                  <Tag>{TYPE_LABELS[item.question_type]}</Tag>
                  <span className="data-text text-ink-subtle">
                    {formatDateTime(item.created_at)}
                  </span>
                </div>
                <Typography.Paragraph
                  className="text-sm"
                  style={{ margin: 0 }}
                  ellipsis={{ rows: 3 }}
                >
                  {item.stem}
                </Typography.Paragraph>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle">
                  <span>作答 {item.attempt_count}</span>
                  <span>学生 {item.student_count}</span>
                </div>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data.items}
            pagination={false}
            className="bg-surface"
          />
        </div>
      )}

      {data && data.items.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            showSizeChanger={false}
            onChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </div>
      ) : null}

      <QuestionFormModal
        open={formOpen}
        question={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
        }}
      />
    </PageShell>
  );
}
