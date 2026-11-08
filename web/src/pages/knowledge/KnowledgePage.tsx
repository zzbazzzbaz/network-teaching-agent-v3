import { Segmented } from 'antd';
import { useSearchParams } from 'react-router';

import { PageShell } from '@/components/common';
import { KnowledgePanel } from '@/features/knowledge';

export function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const visibility = searchParams.get('tab') === 'public' ? 'public' : 'private';

  const changeTab = (value: string | number) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'public') {
      next.set('tab', 'public');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <PageShell>
      <KnowledgePanel
        scope="mine"
        visibility={visibility}
        canCreate={visibility === 'private'}
        canEdit={visibility === 'private'}
        canUpload={visibility === 'private'}
        toolbar={
          <Segmented
            value={visibility}
            onChange={changeTab}
            options={[
              { label: '我的知识库', value: 'private' },
              { label: '公共知识库', value: 'public' },
            ]}
          />
        }
      />
    </PageShell>
  );
}
