import { Button, Result } from 'antd';
import { useNavigate } from 'react-router';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="地址可能已失效，回到对话继续学习。"
      extra={
        <Button type="primary" onClick={() => navigate('/chat')}>
          返回对话
        </Button>
      }
    />
  );
}
