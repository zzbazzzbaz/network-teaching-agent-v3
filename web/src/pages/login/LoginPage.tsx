import { App, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/chat" replace />;
  }

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      await login(values.username.trim(), values.password);
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') ? next : '/chat';
      navigate(target, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        message.error('用户名或密码错误');
      } else if (error instanceof ApiError && error.status === 403) {
        message.error('账号不可用，请联系老师');
      } else {
        message.error('登录失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6 max-[767px]:items-start max-[767px]:pt-16">
      <div className="w-full max-w-[400px] rounded-panel border border-line bg-surface p-8 max-[767px]:border-0 max-[767px]:bg-transparent max-[767px]:p-6">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-chip bg-brand font-code text-xs text-white">
            CN
          </span>
          <span className="data-text text-ink-subtle">netclass / 计算机网络</span>
        </div>
        <h1 className="mb-1 text-2xl leading-tight font-semibold">登录</h1>
        <p className="mb-6 text-[13px] text-ink-muted">使用老师分配的账号登录，开始本轮学习。</p>

        <Form<LoginFormValues>
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleSubmit(values)}
          className="flex flex-col"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 64, message: '用户名为 3–64 个字符' },
            ]}
          >
            <Input autoComplete="username" size="large" placeholder="学号或用户名" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" size="large" placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}
