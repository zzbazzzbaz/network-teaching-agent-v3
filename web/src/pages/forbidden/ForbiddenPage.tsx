import { Button } from 'antd';
import { useNavigate } from 'react-router';

import { StatePage } from '@/components/common/StatePage';

export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <StatePage
      code="403 · FORBIDDEN"
      title="无访问权限"
      description="当前账号不是管理员，无法进入管理端。"
      action={
        <Button type="primary" onClick={() => navigate('/chat')}>
          返回对话
        </Button>
      }
    />
  );
}
