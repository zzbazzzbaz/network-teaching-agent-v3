import { Alert } from 'antd';

import { KnowledgePanel } from '@/features/knowledge';

export function UserKnowledgeTab({ userId }: { userId: string }) {
  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="只读查看"
        description="管理员可以查看该学生的私人知识库和文档，但不能新建、修改、删除或上传。"
      />
      <KnowledgePanel scope="user" userId={userId} visibility="private" />
    </div>
  );
}
