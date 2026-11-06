import { useQuery } from '@tanstack/react-query';
import {
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

import { toErrorMessage } from '@/api/client';
import { listQuestions, type QuestionScope } from '@/api/questions';
import type { QuestionItem, QuestionType } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common';
import { formatDateTime, truncate } from '@/lib/format';
import { useIsMobile } from '@/lib/use-media-query';

import styles from './QuestionsPage.module.css';

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '单选',
  short_answer: '简答',
};

export function QuestionsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const scope: QuestionScope = searchParams.get('scope') === 'mine' ? 'mine' : 'all';
  const typeParam = searchParams.get('type');
  const questionType =
    typeParam === 'single_choice' || typeParam === 'short_answer' ? typeParam : undefined;
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
    queryKey: ['questions', scope, questionType ?? 'all', query, date, page],
    queryFn: () =>
      listQuestions({
        query: query || undefined,
        question_type: questionType,
        scope,
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

  const columns: ColumnsType<QuestionItem> = [
    {
      title: '题干',
      dataIndex: 'stem',
      render: (stem: string, record) => (
        <button
          type="button"
          className={styles.stem}
          onClick={() => navigate(`/questions/${record.id}`)}
        >
          {truncate(stem, 80)}
        </button>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
  ];

  const data = listQuery.data;

  return (
    <div className="page-shell">
      <div className={styles.toolbar}>
        <Segmented
          value={scope}
          onChange={(value) => updateParam('scope', value === 'mine' ? 'mine' : null)}
          options={[
            { label: '全部', value: 'all' },
            { label: '我的', value: 'mine' },
          ]}
        />
        <div className={styles.filters}>
          <DatePicker
            allowClear
            placeholder="按日期筛选"
            value={date ? dayjs(date) : null}
            onChange={(value) => updateParam('date', value ? value.format('YYYY-MM-DD') : null)}
          />
          <Select
            allowClear
            placeholder="全部题型"
            style={{ width: 140 }}
            value={questionType}
            onChange={(value) => updateParam('type', value ?? null)}
            options={[
              { label: '单选题', value: 'single_choice' },
              { label: '简答题', value: 'short_answer' },
            ]}
          />
          <Input.Search
            allowClear
            placeholder="搜索题干"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 240 }}
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : listQuery.isError ? (
        <ErrorState
          title="题库加载失败"
          message={toErrorMessage(listQuery.error, '请稍后重试')}
          onRetry={() => void listQuery.refetch()}
          compact
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="还没有题目" description="完成一次检查题后，题目会出现在这里。" />
      ) : isMobile ? (
        <List
          className={styles.list}
          dataSource={data.items}
          rowKey="id"
          renderItem={(item) => (
            <List.Item
              onClick={() => navigate(`/questions/${item.id}`)}
              className={styles.listItem}
            >
              <div className={styles.listContent}>
                <div className={styles.listMeta}>
                  <Tag>{TYPE_LABELS[item.question_type]}</Tag>
                  <span className="data-text">{formatDateTime(item.created_at)}</span>
                </div>
                <Typography.Paragraph className={styles.listStem} ellipsis={{ rows: 3 }}>
                  {item.stem}
                </Typography.Paragraph>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          pagination={false}
          className={styles.table}
        />
      )}

      {data && data.items.length > 0 ? (
        <div className={styles.pagination}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            showSizeChanger={false}
            onChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </div>
      ) : null}
    </div>
  );
}
