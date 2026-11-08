import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useState } from 'react';

import { createUser } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { UserRole } from '@/api/types';

interface CreateUserFormValues {
  username: string;
  password: string;
  role: UserRole;
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
      password: '',
      role: 'student',
      status: 'active',
    });
  }, [open, form]);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await createUser({
        username: values.username.trim(),
        password: values.password,
        role: values.role,
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

        <Form.Item
          label="初始密码"
          name="password"
          rules={[
            { required: true, message: '请输入初始密码' },
            { min: 6, max: 128, message: '密码为 6-128 个字符' },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="至少 6 个字符" />
        </Form.Item>

        <Form.Item label="角色" name="role" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '学生', value: 'student' },
              { label: '管理员', value: 'admin' },
            ]}
          />
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
    </Modal>
  );
}
