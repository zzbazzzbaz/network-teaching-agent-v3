import { App, Form, Input, Modal } from 'antd';
import { useEffect, useState } from 'react';

import { resetPassword } from '@/api/admin';
import { toErrorMessage } from '@/api/client';

interface PasswordFormValues {
  new_password: string;
  confirm_password: string;
}

export interface PasswordModalProps {
  open: boolean;
  userId: string | null;
  username: string | null;
  onClose: () => void;
}

export function PasswordModal({ open, userId, username, onClose }: PasswordModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const submit = async () => {
    if (!userId) {
      return;
    }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await resetPassword(userId, values.new_password);
      message.success('密码已重置');
      onClose();
    } catch (error) {
      message.error(toErrorMessage(error, '重置密码失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={username ? `重置密码：${username}` : '重置密码'}
      okText="重置"
      cancelText="取消"
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => void submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label="新密码"
          name="new_password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, max: 128, message: '密码为 6-128 个字符' },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="至少 6 个字符" />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirm_password"
          dependencies={['new_password']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="再次输入新密码" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
