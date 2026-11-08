import { request, requestBlob } from './client';
import type {
  KnowledgeBaseCreateRequest,
  KnowledgeBaseItem,
  KnowledgeBaseListResponse,
  KnowledgeBaseUpdateRequest,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentStatusResponse,
  KnowledgeDocumentUploadResponse,
} from './types';

export type KnowledgeScope = 'mine' | 'public' | 'user';

function basePath(scope: KnowledgeScope, userId?: string): string {
  if (scope === 'public') {
    return '/admin/knowledge/public/bases';
  }
  if (scope === 'user') {
    if (!userId) {
      throw new Error('缺少用户 ID');
    }
    return `/admin/users/${encodeURIComponent(userId)}/knowledge/bases`;
  }
  return '/knowledge/bases';
}

export function listKnowledgeBases(
  scope: KnowledgeScope,
  userId?: string,
): Promise<KnowledgeBaseListResponse> {
  return request<KnowledgeBaseListResponse>(basePath(scope, userId));
}

export function createKnowledgeBase(
  scope: KnowledgeScope,
  payload: KnowledgeBaseCreateRequest,
  userId?: string,
): Promise<KnowledgeBaseItem> {
  return request<KnowledgeBaseItem>(basePath(scope, userId), {
    method: 'POST',
    body: payload,
  });
}

export function updateKnowledgeBase(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  payload: KnowledgeBaseUpdateRequest,
  userId?: string,
): Promise<KnowledgeBaseItem> {
  return request<KnowledgeBaseItem>(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}`,
    { method: 'PATCH', body: payload },
  );
}

export function deleteKnowledgeBase(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  userId?: string,
): Promise<void> {
  return request<void>(`${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}`, {
    method: 'DELETE',
  });
}

export function listKnowledgeDocuments(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  userId?: string,
): Promise<KnowledgeDocumentListResponse> {
  return request<KnowledgeDocumentListResponse>(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents`,
  );
}

export function listKnowledgeDocumentStatus(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  documentIds: string[],
  userId?: string,
): Promise<KnowledgeDocumentStatusResponse> {
  const search = new URLSearchParams({ ids: documentIds.join(',') });
  return request<KnowledgeDocumentStatusResponse>(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents/status?${search.toString()}`,
  );
}

export function uploadKnowledgeDocument(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  file: File,
  userId?: string,
): Promise<KnowledgeDocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (file.type) {
    formData.append('content_type', file.type);
  }
  return request<KnowledgeDocumentUploadResponse>(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents`,
    { method: 'POST', formData },
  );
}

export function deleteKnowledgeDocument(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  documentId: string,
  userId?: string,
): Promise<void> {
  return request<void>(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

export async function downloadKnowledgeDocument(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  documentId: string,
  filename: string,
  userId?: string,
): Promise<void> {
  const blob = await requestBlob(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents/${encodeURIComponent(documentId)}?download=true`,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
