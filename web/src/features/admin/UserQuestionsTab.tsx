import { EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Pagination, Skeleton, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link } from 'react-router';

import { listUserQuestions } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { QuestionRecordItem, QuestionType } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common';
import { formatDateTime, truncate } from '@/lib/format';

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '单选',
  short_answer: '简答',
};

export function UserQuestionsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);

  const questionsQuery = useQuery({
    queryKey: ['admin-user-questions', userId, page],
    queryFn: () =>
      listUserQuestions(userId, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  });

  const columns: ColumnsType<QuestionRecordItem> = [
    {
      title: '题干',
      dataIndex: 'stem',
      ellipsis: true,
      render: (value: string) => (
        <Typography.Text className="text-[13px]">{truncate(value, 80)}</Typography.Text>
      ),
    },
    {
      title: '题型',
      dataIndex: 'question_type',
      width: 80,
      render: (value: QuestionType) => <Tag>{TYPE_LABELS[value]}</Tag>,
    },
    {
      title: '学生答案',
      dataIndex: 'student_answer',
      ellipsis: true,
      render: (value: string) => (
        <Typography.Text className="text-[13px]">{truncate(value, 60)}</Typography.Text>
      ),
    },
    {
      title: '参考答案',
      dataIndex: 'correct_answer',
      ellipsis: true,
      render: (value: string) => (
        <Typography.Text className="text-[13px]">{truncate(value, 60)}</Typography.Text>
      ),
    },
    {
      title: '作答时间',
      dataIndex: 'answered_at',
      width: 160,
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
    {
      title: '会话',
      dataIndex: 'session_id',
      width: 70,
      render: (value: string) => (
        <Link
          to={`/admin/users/${userId}/sessions/${value}`}
          className="text-brand hover:text-brand-strong"
          title="查看会话"
          aria-label="查看会话"
        >
          <EyeOutlined />
        </Link>
      ),
    },
  ];

  if (questionsQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (questionsQuery.isError) {
    return (
      <ErrorState
        title="答题记录加载失败"
        message={toErrorMessage(questionsQuery.error, '请稍后重试')}
        onRetry={() => void questionsQuery.refetch()}
        compact
      />
    );
  }

  const data = questionsQuery.data;

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="还没有答题记录"
        description="学生完成检查题后，答题记录会显示在这里。"
      />
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface">
      <Table
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={data.items}
        pagination={false}
      />
      <div className="flex justify-end px-4 py-3">
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          showSizeChanger={false}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
