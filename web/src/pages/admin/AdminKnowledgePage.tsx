import { Typography } from 'antd';

import { PageShell } from '@/components/common';
import { KnowledgePanel } from '@/features/knowledge';

export function AdminKnowledgePage() {
  return (
    <PageShell>
      <Typography.Title level={4} className="mt-0 mb-2">
        公共知识库
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="mb-5">
        这里的知识库会共享给所有学生，学生只能查看和检索，不能修改。
      </Typography.Paragraph>
      <KnowledgePanel
        scope="public"
        visibility="public"
        canCreate
        canEdit
        canUpload
      />
    </PageShell>
  );
}
