import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Radio, Select } from 'antd';
import { useEffect, useState } from 'react';

import { createQuestion, updateQuestion } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type {
  AdminQuestionDetail,
  AdminQuestionPayload,
  AdminQuestionUpdatePayload,
  QuestionType,
} from '@/api/types';

const LETTERS = 'ABCDEF';

interface OptionField {
  text: string;
}

interface QuestionFormValues {
  question_type: QuestionType;
  stem: string;
  options?: OptionField[];
  answer_choice?: string;
  answer_text?: string;
  note?: string;
}

export interface QuestionFormModalProps {
  open: boolean;
  question: AdminQuestionDetail | null;
  onClose: () => void;
  onSaved: () => void;
}

function normalizeNote(value: string | undefined): string | null {
  const note = value?.trim() ?? '';
  return note || null;
}

export function QuestionFormModal({
  open,
  question,
  onClose,
  onSaved,
}: QuestionFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<QuestionFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const questionType = Form.useWatch('question_type', form);
  const optionValues = Form.useWatch('options', form);
  const isEdit = Boolean(question);
  const contentLocked = Boolean(question && question.attempt_total > 0);
  const isChoice = questionType !== 'short_answer';
  const optionCount = Math.max(optionValues?.length ?? 0, 2);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (question) {
      const entries = question.options ? Object.entries(question.options) : [];
      form.setFieldsValue({
        question_type: question.question_type,
        stem: question.stem,
        options: entries.map(([, text]) => ({ text })),
        answer_choice: question.question_type === 'single_choice' ? question.answer_text : undefined,
        answer_text: question.question_type === 'short_answer' ? question.answer_text : undefined,
        note: question.note ?? '',
      });
      return;
    }
    form.setFieldsValue({
      question_type: 'single_choice',
      stem: '',
      options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
      answer_choice: undefined,
      answer_text: undefined,
      note: '',
    });
  }, [open, question, form]);

  const submit = async () => {
    if (contentLocked && question) {
      const note = normalizeNote(form.getFieldValue('note'));
      setSubmitting(true);
      try {
        await updateQuestion(question.id, { note });
        message.success('备注已更新');
        onSaved();
        onClose();
      } catch (error) {
        message.error(toErrorMessage(error, '更新失败'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const values = await form.validateFields();
    const note = normalizeNote(values.note);
    const type = values.question_type ?? 'single_choice';
    let options: Record<string, string> | null = null;
    let answerText: string;

    if (type === 'single_choice') {
      const items = values.options ?? [];
      if (items.length < 2) {
        message.error('单选题至少需要 2 个选项');
        return;
      }
      if (items.some((item) => !item.text?.trim())) {
        message.error('选项内容不能为空');
        return;
      }
      options = {};
      items.forEach((item, index) => {
        options![LETTERS[index]] = item.text.trim();
      });
      answerText = values.answer_choice?.trim() ?? '';
      if (!answerText || !options[answerText]) {
        message.error('请选择单选题的正确答案');
        return;
      }
    } else {
      answerText = values.answer_text?.trim() ?? '';
      if (!answerText) {
        message.error('请填写简答题参考答案');
        return;
      }
    }

    const stem = values.stem?.trim() ?? '';
    if (!stem) {
      message.error('请填写题干');
      return;
    }

    setSubmitting(true);
    try {
      if (question) {
        const payload: AdminQuestionUpdatePayload = {
          stem,
          question_type: type,
          options,
          answer_text: answerText,
          note,
        };
        await updateQuestion(question.id, payload);
        message.success('题目已更新');
      } else {
        const payload: AdminQuestionPayload = {
          stem,
          question_type: type,
          options,
          answer_text: answerText,
          note,
        };
        await createQuestion(payload);
        message.success('公共题已创建');
      }
      onSaved();
      onClose();
    } catch (error) {
      message.error(toErrorMessage(error, isEdit ? '更新失败' : '创建失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      width={720}
      title={isEdit ? (contentLocked ? '编辑备注' : '编辑公共题') : '新建公共题'}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => void submit()}
      destroyOnHidden
    >
      {contentLocked ? (
        <p className="mt-0 mb-4 rounded-chip bg-surface-sunken px-3 py-2 text-[13px] text-ink-muted">
          该题已有作答记录，只能修改备注。
        </p>
      ) : null}

      <Form form={form} layout="vertical" requiredMark={false}>
        {contentLocked ? null : (
          <>
            <Form.Item label="题型" name="question_type" rules={[{ required: true }]}>
              <Radio.Group
                options={[
                  { label: '单选题', value: 'single_choice' },
                  { label: '简答题', value: 'short_answer' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="题干"
              name="stem"
              rules={[
                { required: true, message: '请输入题干' },
                { max: 5000, message: '题干最长 5000 个字符' },
              ]}
            >
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} placeholder="支持 Markdown" />
            </Form.Item>

            {isChoice ? (
              <>
                <Form.Item label="选项">
                  <Form.List name="options">
                    {(fields, { add, remove }) => (
                      <div className="flex flex-col gap-2">
                        {fields.map((field, index) => (
                          <div key={field.key} className="flex items-start gap-2">
                            <span className="mt-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-code text-xs text-ink-muted">
                              {LETTERS[index]}
                            </span>
                            <Form.Item
                              name={[field.name, 'text']}
                              className="mb-0 flex-1"
                              rules={[{ required: true, message: '请输入选项内容' }]}
                            >
                              <Input placeholder={`选项 ${LETTERS[index]}`} />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              disabled={fields.length <= 2}
                              onClick={() => remove(field.name)}
                              aria-label={`删除选项 ${LETTERS[index]}`}
                            />
                          </div>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          disabled={fields.length >= 6}
                          onClick={() => add({ text: '' })}
                        >
                          添加选项
                        </Button>
                      </div>
                    )}
                  </Form.List>
                </Form.Item>

                <Form.Item
                  label="正确答案"
                  name="answer_choice"
                  rules={[{ required: true, message: '请选择正确答案' }]}
                >
                  <Select
                    placeholder="选择正确选项"
                    options={Array.from({ length: optionCount }, (_, index) => ({
                      label: `选项 ${LETTERS[index]}`,
                      value: LETTERS[index],
                    }))}
                  />
                </Form.Item>
              </>
            ) : (
              <Form.Item
                label="参考答案"
                name="answer_text"
                rules={[
                  { required: true, message: '请输入参考答案' },
                  { max: 5000, message: '参考答案最长 5000 个字符' },
                ]}
              >
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
              </Form.Item>
            )}
          </>
        )}

        <Form.Item
          label="备注"
          name="note"
          rules={[{ max: 2000, message: '备注最长 2000 个字符' }]}
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder="可选" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
