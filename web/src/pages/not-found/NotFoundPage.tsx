import { Button } from 'antd';
import { useNavigate } from 'react-router';

import { StatePage } from '@/components/common/StatePage';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <StatePage
      code="404 · NOT FOUND"
      title="页面不存在"
      description="地址可能已失效，回到对话继续学习。"
      action={
        <Button type="primary" onClick={() => navigate('/chat')}>
          返回对话
        </Button>
      }
    />
  );
}
