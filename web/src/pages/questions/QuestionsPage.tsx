import { useQuery } from '@tanstack/react-query';
import {
  DatePicker,
  Input,
  List,
  Pagination,
  Select,
  Skeleton,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { toErrorMessage } from '@/api/client';
import { listQuestions } from '@/api/questions';
import type { QuestionRecordItem, QuestionType } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { formatDateTime, truncate } from '@/lib/format';
import { useIsMobile } from '@/lib/use-media-query';

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '单选',
  short_answer: '简答',
};

function parseType(value: string | null): QuestionType | undefined {
  return value === 'single_choice' || value === 'short_answer' ? value : undefined;
}

function QuestionTypeTag({ type }: { type: QuestionType }) {
  const single = type === 'single_choice';
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-1.5 text-[10.5px] leading-[19px] font-medium ${
        single ? 'bg-brand-soft text-brand' : 'bg-surface-sunken text-ink-muted'
      }`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export function QuestionsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const questionType = parseType(searchParams.get('type'));
  const query = searchParams.get('q') ?? '';
  const date = searchParams.get('date') ?? '';
  const page = Math.max(Number(searchParams.get('page') ?? '1'), 1);

  const [keyword, setKeyword] = useState(query);

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

  const listQuery = useQuery({
    queryKey: ['questions', questionType ?? 'all', query, date, page],
    queryFn: () =>
      listQuestions({
        query: query || undefined,
        question_type: questionType,
        date: date || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
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
    setSearchParams(next, { replace: true });
  };

  const columns: ColumnsType<QuestionRecordItem> = [
    {
      title: '题干',
      dataIndex: 'stem',
      render: (stem: string, record) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm text-ink hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => navigate(`/questions/${record.id}`)}
        >
          {truncate(stem, 80)}
        </button>
      ),
    },
    {
      title: '题型',
      dataIndex: 'question_type',
      width: 90,
      render: (value: QuestionType) => <QuestionTypeTag type={value} />,
    },
    {
      title: '我的答案',
      dataIndex: 'student_answer',
      width: 200,
      ellipsis: true,
      render: (value: string) => <span className="text-sm">{truncate(value, 60)}</span>,
    },
    {
      title: '作答时间',
      dataIndex: 'answered_at',
      width: 170,
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
  ];

  const data = listQuery.data;

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 max-[767px]:flex-col max-[767px]:items-stretch">
        <div className="flex items-baseline gap-2">
          <span className="eyebrow">RECORDS</span>
          <span className="font-code text-[12px] text-ink-muted">{data?.total ?? 0}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[767px]:flex-col max-[767px]:items-stretch">
          <DatePicker
            allowClear
            className="w-[150px] max-[767px]:w-full"
            placeholder="作答日期"
            value={date ? dayjs(date) : null}
            onChange={(value) => updateParam('date', value ? value.format('YYYY-MM-DD') : null)}
          />
          <Select
            allowClear
            className="w-[140px] max-[767px]:w-full"
            placeholder="全部题型"
            value={questionType}
            onChange={(value) => updateParam('type', value ?? null)}
            options={[
              { label: '单选题', value: 'single_choice' },
              { label: '简答题', value: 'short_answer' },
            ]}
          />
          <Input.Search
            allowClear
            className="w-[240px] max-[767px]:w-full"
            placeholder="搜索题干"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : listQuery.isError ? (
        <ErrorState
          title="答题记录加载失败"
          message={toErrorMessage(listQuery.error, '请稍后重试')}
          onRetry={() => void listQuery.refetch()}
          compact
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="还没有答题记录"
          description="完成一次检查题后，题目和你的答案会记录在这里。"
        />
      ) : isMobile ? (
        <List
          className="overflow-hidden rounded-card border border-line bg-surface"
          dataSource={data.items}
          rowKey="id"
          renderItem={(item) => (
            <List.Item
              onClick={() => navigate(`/questions/${item.id}`)}
              className="cursor-pointer"
              style={{ padding: '12px 16px' }}
            >
              <div className="w-full">
                <div className="mb-1.5 flex items-center gap-2 text-ink-subtle">
                  <QuestionTypeTag type={item.question_type} />
                  <span className="data-text">{formatDateTime(item.answered_at)}</span>
                </div>
                <Typography.Paragraph
                  className="text-sm"
                  style={{ margin: 0 }}
                  ellipsis={{ rows: 3 }}
                >
                  {item.stem}
                </Typography.Paragraph>
                <Typography.Text className="mt-1 block text-xs text-ink-subtle" ellipsis>
                  我的答案：{item.student_answer}
                </Typography.Text>
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
    </PageShell>
  );
}
