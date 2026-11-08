import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useState } from 'react';

import { createUser, updateUser } from '@/api/admin';
import { toErrorMessage } from '@/api/client';
import type { AdminUserDetail, UserRole } from '@/api/types';

interface UserFormValues {
  username: string;
  password?: string;
  role: UserRole;
  status: 'active' | 'disabled';
}

export interface UserFormModalProps {
  open: boolean;
  user: AdminUserDetail | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({ open, user, isSelf, onClose, onSaved }: UserFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<UserFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      username: user?.username ?? '',
      password: '',
      role: user?.role ?? 'student',
      status: user?.status ?? 'active',
    });
  }, [open, user, form]);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (user) {
        await updateUser(user.id, {
          username: values.username.trim(),
          ...(isSelf ? {} : { role: values.role, status: values.status }),
        });
        message.success('用户已更新');
      } else {
        await createUser({
          username: values.username.trim(),
          password: values.password ?? '',
          role: values.role,
          status: values.status,
        });
        message.success('用户已创建');
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
      title={isEdit ? '编辑用户' : '创建用户'}
      okText={isEdit ? '保存' : '创建'}
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

        {isEdit ? null : (
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
        )}

        <Form.Item label="角色" name="role" rules={[{ required: true }]}>
          <Select
            disabled={isSelf}
            options={[
              { label: '学生', value: 'student' },
              { label: '管理员', value: 'admin' },
            ]}
          />
        </Form.Item>

        <Form.Item label="状态" name="status" rules={[{ required: true }]}>
          <Select
            disabled={isSelf}
            options={[
              { label: '正常', value: 'active' },
              { label: '禁用', value: 'disabled' },
            ]}
          />
        </Form.Item>

        {isSelf ? (
          <p className="m-0 text-xs text-ink-subtle">不能修改自己的角色或禁用自己。</p>
        ) : null}
      </Form>
    </Modal>
  );
}
