import { Tabs, Typography } from 'antd';

import { PageShell } from '@/components/common';
import { KnowledgePanel } from '@/features/knowledge';

export function KnowledgePage() {
  return (
    <PageShell>
      <Typography.Title level={4} className="mt-0 mb-2">
        知识库
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="mb-5">
        上传自己的复习资料，或在对话中检索公共资料。公共知识库由管理员维护，只读。
      </Typography.Paragraph>

      <Tabs
        items={[
          {
            key: 'private',
            label: '我的知识库',
            children: (
              <KnowledgePanel
                scope="mine"
                visibility="private"
                canCreate
                canEdit
                canUpload
              />
            ),
          },
          {
            key: 'public',
            label: '公共知识库',
            children: <KnowledgePanel scope="mine" visibility="public" />,
          },
        ]}
      />
    </PageShell>
  );
}
