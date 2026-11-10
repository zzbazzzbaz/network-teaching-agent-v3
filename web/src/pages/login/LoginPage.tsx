import { App, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { BrandLockup } from '@/components/common';
import { HandshakeDiagram, LayerDiagram } from '@/components/common/NetworkMotifs';
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
    <div className="min-h-screen bg-surface">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <aside className="relative hidden overflow-hidden bg-ink px-12 py-10 lg:flex xl:px-16">
          <div className="network-grid pointer-events-none absolute inset-0" aria-hidden="true" />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <BrandLockup tone="dark" size={34} />

            <div className="my-auto w-full max-w-[540px] py-8">
              <div className="login-handshake">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-px w-4 bg-white/20" aria-hidden="true" />
                  <span className="font-code text-[10px] tracking-[0.12em] text-white/50">
                    TCP 三次握手
                  </span>
                </div>
                <HandshakeDiagram tone="dark" />
                <div className="mt-7 border-t border-white/10" />
              </div>

              <div className="pt-6">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="h-px w-4 bg-white/20" aria-hidden="true" />
                  <span className="font-code text-[10px] tracking-[0.12em] text-white/50">
                    一次请求的路径
                  </span>
                </div>
                <LayerDiagram tone="dark" />
              </div>
            </div>

            <div className="flex items-end justify-between gap-6">
              <p className="m-0 max-w-[300px] text-[13px] leading-6 text-white/55">
                答疑、检索与练习，在一个对话里完成。
              </p>
              <span className="font-code text-[10px] tracking-[0.08em] text-white/25">
                RFC 793 · RFC 791
              </span>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col justify-start px-6 pt-16 pb-10 lg:justify-center lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto w-full max-w-[352px]">
            <BrandLockup className="mb-10 lg:hidden" size={32} />

            <p className="m-0 mb-3 font-code text-[10px] tracking-[0.14em] text-ink-subtle">
              NETWORK CLASSROOM
            </p>
            <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em] text-ink">
              登录课程空间
            </h1>

            <Form<LoginFormValues>
              layout="vertical"
              requiredMark={false}
              onFinish={(values) => void handleSubmit(values)}
              className="mt-8 flex flex-col"
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, max: 64, message: '用户名为 3–64 个字符' },
                ]}
              >
                <Input
                  autoComplete="username"
                  autoFocus
                  className="h-10 !text-[14px]"
                  placeholder="学号或用户名"
                />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  autoComplete="current-password"
                  className="h-10 !text-[14px]"
                  placeholder="输入密码…"
                />
              </Form.Item>
              <Button
                className="mt-1 h-10 !text-[14px]"
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
              >
                登录
              </Button>
            </Form>
          </div>
        </main>
      </div>
    </div>
  );
}
