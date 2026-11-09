import { App, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { BrandMark } from '@/components/common';
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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6 max-[767px]:items-start max-[767px]:pt-14">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-panel border border-line bg-surface shadow-[0_28px_70px_-44px_rgba(16,23,32,0.45)] md:grid-cols-[0.95fr_1fr] max-[767px]:max-w-[400px] max-[767px]:rounded-none max-[767px]:border-0 max-[767px]:bg-transparent max-[767px]:shadow-none">
        <aside
          className="relative hidden flex-col justify-between overflow-hidden p-9 text-white md:flex"
          style={{
            background: 'linear-gradient(158deg, #176a80 0%, #12586b 48%, #0b3b48 100%)',
          }}
        >
          <div className="relative flex items-center gap-2.5">
            <BrandMark size={34} className="shrink-0" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">计算机网络</div>
              <div className="text-xs text-white/70">教学智能体</div>
            </div>
          </div>

          <NetworkGraph />

          <p className="relative m-0 max-w-[280px] text-sm leading-6 text-white/70">
            答疑、检索与练习，在一个对话里完成。
          </p>
        </aside>

        <div className="flex flex-col justify-center p-9 max-[767px]:p-0">
          <div className="mb-7 flex items-center gap-2.5 md:hidden">
            <BrandMark size={30} className="shrink-0" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">计算机网络</div>
              <div className="text-xs text-ink-subtle">教学智能体</div>
            </div>
          </div>

          <h1 className="mb-7 text-2xl leading-tight font-semibold">登录</h1>

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
            <Button
              className="mt-1"
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
            >
              登录
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

function NetworkGraph() {
  return (
    <svg viewBox="0 0 396 260" className="relative my-4 w-full" fill="none" aria-hidden="true">
      <g stroke="#c7e8f0" strokeWidth="1.2" strokeOpacity="0.3">
        <path d="M198 138 58 46M198 138 330 38M198 138 34 150M198 138 360 140M198 138 108 232M198 138 292 236" />
      </g>
      <g stroke="#c7e8f0" strokeWidth="1" strokeOpacity="0.16" strokeDasharray="4 6">
        <path d="M58 46 34 150M330 38 360 140M108 232 292 236" />
      </g>

      <g fill="#eaf6f9">
        <circle cx="198" cy="138" r="30" fillOpacity="0.08" />
        <circle cx="198" cy="138" r="18" fillOpacity="0.12" />
        <circle cx="198" cy="138" r="6.5" />
      </g>

      <g>
        <circle cx="58" cy="46" r="9" stroke="#eaf6f9" strokeOpacity="0.3" />
        <circle cx="330" cy="38" r="9" stroke="#eaf6f9" strokeOpacity="0.3" />
        <circle cx="34" cy="150" r="9" stroke="#eaf6f9" strokeOpacity="0.3" />
        <circle cx="360" cy="140" r="9" stroke="#eaf6f9" strokeOpacity="0.3" />
        <circle cx="108" cy="232" r="9" stroke="#eaf6f9" strokeOpacity="0.3" />
        <circle cx="292" cy="236" r="9" stroke="#eaf6f9" strokeOpacity="0.3" />
        <g fill="#eaf6f9" fillOpacity="0.9">
          <circle cx="58" cy="46" r="4" />
          <circle cx="330" cy="38" r="4" />
          <circle cx="34" cy="150" r="4" />
          <circle cx="360" cy="140" r="4" />
          <circle cx="108" cy="232" r="4" />
          <circle cx="292" cy="236" r="4" />
        </g>
      </g>

      <g fill="#ffffff" fillOpacity="0.55" fontSize="11" letterSpacing="0.4" textAnchor="middle">
        <text x="58" y="66">
          TCP
        </text>
        <text x="330" y="58">
          IP
        </text>
        <text x="34" y="170">
          路由
        </text>
        <text x="360" y="160">
          子网
        </text>
        <text x="108" y="252">
          HTTP
        </text>
        <text x="292" y="256">
          UDP
        </text>
      </g>
    </svg>
  );
}
