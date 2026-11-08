import { App, Form, Input, Modal, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { createUser } from '@/api/admin';
import { toErrorMessage } from '@/api/client';

interface CreateUserFormValues {
  username: string;
  status: 'active' | 'disabled';
}

export interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateUserFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      username: '',
      status: 'active',
    });
  }, [open, form]);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await createUser({
        username: values.username.trim(),
        status: values.status,
      });
      message.success('用户已创建');
      onCreated();
      onClose();
    } catch (error) {
      message.error(toErrorMessage(error, '创建失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="创建用户"
      okText="创建"
      cancelText="取消"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => void submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label="用户名"
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, max: 64, message: '用户名为 3-64 个字符' },
            { pattern: /^\S+$/, message: '用户名不能包含空白字符' },
          ]}
        >
          <Input autoComplete="off" placeholder="学号或用户名" />
        </Form.Item>

        <Form.Item label="角色">
          <Typography.Text>学生</Typography.Text>
        </Form.Item>

        <Form.Item label="状态" name="status" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '正常', value: 'active' },
              { label: '禁用', value: 'disabled' },
            ]}
          />
        </Form.Item>
      </Form>

      <Typography.Paragraph type="secondary" className="mb-0 text-xs">
        初始密码为用户名后追加 000000，例如 student01 的初始密码为 student01000000。
        首次登录后需要修改密码。
      </Typography.Paragraph>
    </Modal>
  );
}
