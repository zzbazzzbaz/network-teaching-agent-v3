import { Button, Result } from 'antd';
import { useNavigate, useRouteError } from 'react-router';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message =
    error instanceof Error ? error.message : '页面渲染时出现异常，可以换个页面继续使用。';

  return (
    <Result
      status="error"
      title="页面出错了"
      subTitle={message}
      extra={[
        <Button key="chat" type="primary" onClick={() => navigate('/chat')}>
          返回对话
        </Button>,
        <Button key="reload" onClick={() => window.location.reload()}>
          刷新页面
        </Button>,
      ]}
    />
  );
}
