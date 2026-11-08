import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Pagination,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { deleteQuestion, getQuestion, listQuestionAttempts } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { AdminAttemptItem } from '@/api/types';
import { EmptyState, ErrorState, PageShell } from '@/components/common';
import { QuestionFormModal } from '@/features/admin/QuestionFormModal';
import { Markdown } from '@/features/chat/markdown';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 20;

export function AdminQuestionDetailPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [page, setPage] = useState(1);

  const questionQuery = useQuery({
    queryKey: ['admin-question', questionId],
    queryFn: () => getQuestion(questionId as string),
    enabled: Boolean(questionId),
    retry: false,
  });

  const question = questionQuery.data;

  const attemptsQuery = useQuery({
    queryKey: ['admin-question-attempts', questionId, page],
    queryFn: () => listQuestionAttempts(questionId as string, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    enabled: Boolean(questionId) && Boolean(question),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-question', questionId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-question-attempts', questionId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
  };

  const remove = () => {
    if (!question) {
      return;
    }
    modal.confirm({
      title: '删除这道公共题？',
      content: '删除后题目不再出现在列表中，本期不支持恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteQuestion(question.id);
          message.success('题目已删除');
          void queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
          navigate('/admin/questions');
        } catch (error) {
          message.error(toErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  if (questionQuery.isLoading) {
    return (
      <PageShell>
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageShell>
    );
  }

  if (questionQuery.isError || !question) {
    return (
      <PageShell>
        <ErrorState
          title="题目加载失败"
          message={toErrorMessage(questionQuery.error, '题目可能已被删除')}
          onRetry={() => void questionQuery.refetch()}
        />
      </PageShell>
    );
  }

  const options = question.options ? Object.entries(question.options) : [];
  const isChoice = question.question_type === 'single_choice';
  const hasAttempts = question.attempt_total > 0;

  const attemptColumns: ColumnsType<AdminAttemptItem> = [
    {
      title: '学生',
      dataIndex: 'username',
      width: 130,
      render: (username: string, record) => (
        <Link
          to={`/admin/users/${record.user_id}`}
          className="text-brand hover:text-brand-strong hover:underline"
        >
          {username}
        </Link>
      ),
    },
    {
      title: '答案',
      dataIndex: 'answer_text',
      ellipsis: true,
      render: (value: string) => (
        <Typography.Text className="text-[13px]">{value}</Typography.Text>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 160,
      render: (value: string) => <span className="data-text">{formatDateTime(value)}</span>,
    },
    {
      title: '会话',
      dataIndex: 'session_title',
      width: 180,
      ellipsis: true,
      responsive: ['lg'],
      render: (value: string | null, record) => (
        <Link
          to={`/admin/users/${record.user_id}/sessions/${record.session_id}`}
          className="text-ink-muted hover:text-brand"
        >
          {value ?? '\u2014'}
        </Link>
      ),
    },
  ];

  const attempts = attemptsQuery.data?.items ?? [];
  const attemptsTotal = attemptsQuery.data?.total ?? 0;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[900px]">
        <button
          type="button"
          className="mb-3 inline-flex items-center gap-1 rounded-chip py-1.5 text-sm text-ink-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => navigate('/admin/questions')}
        >
          <ArrowLeftOutlined aria-hidden="true" />
          返回题目管理
        </button>

        <Card className="border border-line" size="small">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={question.is_public ? 'blue' : 'default'}>
                {question.is_public ? '公共题' : `${question.owner_username ?? '学生'}的私有题`}
              </Tag>
              <Tag>{isChoice ? '单选题' : '简答题'}</Tag>
              <span className="data-text text-ink-subtle">
                创建于 {formatDateTime(question.created_at)}
              </span>
            </div>
            {question.is_public ? (
              <Space>
                <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                  {hasAttempts ? '编辑备注' : '编辑'}
                </Button>
                {hasAttempts ? null : (
                  <Button danger icon={<DeleteOutlined />} onClick={remove}>
                    删除
                  </Button>
                )}
              </Space>
            ) : (
              <Typography.Text type="secondary" className="text-xs">
                学生私有题只读
              </Typography.Text>
            )}
          </div>

          <Markdown content={question.stem} className="text-base leading-[1.85]" />

          {options.length > 0 ? (
            <ol className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
              {options.map(([letter, text]) => (
                <li
                  key={letter}
                  className={`flex items-start gap-3 rounded-card border px-3.5 py-2.5 ${
                    isChoice && question.answer_text === letter
                      ? 'border-brand/40 bg-brand-soft'
                      : 'border-line bg-surface'
                  }`}
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-code text-xs leading-none text-ink-muted">
                    {letter}
                  </span>
                  <span className="text-[15px] leading-relaxed">{text}</span>
                  {isChoice && question.answer_text === letter ? (
                    <span className="ml-auto shrink-0 text-[11px] text-brand">正确答案</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {question.note ? (
            <Alert
              className="mt-4"
              type="info"
              showIcon
              message="备注"
              description={question.note}
            />
          ) : null}

          <section className="mt-5 border-t border-line pt-4">
            <div className="mb-2 text-[13px] font-semibold text-ink-muted">参考答案</div>
            <div className="whitespace-pre-wrap rounded-chip border-l-[3px] border-brand bg-brand-soft px-4 py-3 text-[14px] leading-[1.8] [overflow-wrap:anywhere]">
              {question.answer_text}
            </div>
          </section>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-muted">
            <span>作答次数：{question.attempt_total}</span>
            <span>作答学生：{question.student_count}</span>
          </div>
        </Card>

        <section className="mt-5 rounded-card border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="m-0 text-base font-semibold leading-normal">跨学生作答记录</h2>
            <span className="data-text text-ink-subtle">{attemptsTotal} 次</span>
          </header>

          {attemptsQuery.isLoading ? (
            <div className="p-4">
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          ) : attemptsQuery.isError ? (
            <ErrorState
              title="作答记录加载失败"
              message={toErrorMessage(attemptsQuery.error, '请稍后重试')}
              onRetry={() => void attemptsQuery.refetch()}
              compact
            />
          ) : attempts.length === 0 ? (
            <EmptyState title="还没有作答记录" description="学生完成这道题后，作答会记录在这里。" />
          ) : (
            <>
              <Table
                rowKey="id"
                size="middle"
                columns={attemptColumns}
                dataSource={attempts}
                pagination={false}
              />
              <div className="flex justify-end px-4 py-3">
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={attemptsTotal}
                  showSizeChanger={false}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </section>
      </div>

      <QuestionFormModal
        open={editOpen}
        question={question}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
      />
    </PageShell>
  );
}
