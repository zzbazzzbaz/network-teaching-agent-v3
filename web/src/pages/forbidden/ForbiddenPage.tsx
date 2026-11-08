import { Button, Result } from 'antd';
import { useNavigate } from 'react-router';

export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="403"
      title="无访问权限"
      subTitle="当前账号不是管理员，无法进入管理端。"
      extra={
        <Button type="primary" onClick={() => navigate('/chat')}>
          返回对话
        </Button>
      }
    />
  );
}
