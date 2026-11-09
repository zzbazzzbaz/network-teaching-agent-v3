import { Alert, App, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { changePassword } from '@/api/auth';
import { toErrorMessage } from '@/api/client';
import { BrandLockup } from '@/components/common';
import { defaultPassword } from '@/lib/password';
import { useAuthStore } from '@/stores/auth-store';

interface ChangePasswordFormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export function ChangePasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearPasswordChangeRequirement = useAuthStore(
    (state) => state.clearPasswordChangeRequirement,
  );
  const [submitting, setSubmitting] = useState(false);

  const username = user?.username ?? '';

  const handleSubmit = async (values: ChangePasswordFormValues) => {
    setSubmitting(true);
    try {
      const updated = await changePassword(values.old_password, values.new_password);
      updateUser(updated);
      clearPasswordChangeRequirement();
      message.success('密码已修改');
      navigate('/chat', { replace: true });
    } catch (error) {
      message.error(toErrorMessage(error, '修改密码失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6 max-[767px]:items-start max-[767px]:pt-16">
      <div className="w-full max-w-[460px] rounded-panel border border-line bg-surface p-8 shadow-[0_18px_48px_-32px_rgb(18_26_28/28%)] max-[767px]:border-0 max-[767px]:bg-transparent max-[767px]:p-6 max-[767px]:shadow-none">
        <BrandLockup className="mb-9" size={32} />
        <p className="m-0 mb-2 font-code text-[10px] tracking-[0.14em] text-ink-subtle">ACCOUNT</p>
        <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
          修改密码
        </h1>
        <div className="mt-2 mb-7 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
          <span>当前账号</span>
          <span className="font-medium text-ink">{username || '\u2014'}</span>
        </div>

        {mustChangePassword ? (
          <Alert
            className="mb-5"
            type="info"
            showIcon
            message="当前使用的是初始密码，请先修改密码后继续使用。"
          />
        ) : null}

        <Form<ChangePasswordFormValues>
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleSubmit(values)}
          className="flex flex-col"
        >
          <Form.Item
            label="当前密码"
            name="old_password"
            rules={[
              { required: true, message: '请输入当前密码' },
              { min: 6, max: 128, message: '密码为 6-128 个字符' },
            ]}
          >
            <Input.Password
              autoComplete="current-password"
              className="h-10 !text-[14px]"
              placeholder="当前密码"
            />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="new_password"
            dependencies={['old_password']}
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, max: 128, message: '密码为 6-128 个字符' },
              ({ getFieldValue }) => ({
                validator(_, value: string | undefined) {
                  if (!value) {
                    return Promise.resolve();
                  }
                  if (value === getFieldValue('old_password')) {
                    return Promise.reject(new Error('新密码不能与当前密码相同'));
                  }
                  if (username && value === defaultPassword(username)) {
                    return Promise.reject(new Error('新密码不能使用初始密码'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              className="h-10 !text-[14px]"
              placeholder="新密码"
            />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value: string | undefined) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              className="h-10 !text-[14px]"
              placeholder="再次输入新密码"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            className="h-10 !text-[14px]"
            block
            loading={submitting}
          >
            确认修改
          </Button>

          {!mustChangePassword ? (
            <Button
              className="mt-2 h-10 !text-[13px]"
              type="text"
              block
              onClick={() => navigate('/chat')}
            >
              返回对话
            </Button>
          ) : null}
        </Form>
      </div>
    </div>
  );
}
