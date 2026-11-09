import { KnowledgePanel } from '@/features/knowledge';

export function UserKnowledgeTab({ userId }: { userId: string }) {
  return <KnowledgePanel scope="user" userId={userId} visibility="private" />;
}
