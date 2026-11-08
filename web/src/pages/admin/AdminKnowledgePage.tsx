import { PageShell } from '@/components/common';
import { KnowledgePanel } from '@/features/knowledge';

export function AdminKnowledgePage() {
  return (
    <PageShell>
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
