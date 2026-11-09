import { Button } from 'antd';
import { useNavigate, useRouteError } from 'react-router';

import { StatePage } from '@/components/common/StatePage';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message =
    error instanceof Error ? error.message : '页面渲染时出现异常，可以换个页面继续使用。';

  return (
    <StatePage
      code="ERROR · RENDER"
      title="页面出错了"
      description={message}
      action={
        <div className="flex items-center gap-2">
          <Button type="primary" onClick={() => navigate('/chat')}>
            返回对话
          </Button>
          <Button onClick={() => window.location.reload()}>刷新页面</Button>
        </div>
      }
    />
  );
}
