import { request } from './client';
import type {
  KnowledgeBaseCreateRequest,
  KnowledgeBaseItem,
  KnowledgeBaseListResponse,
  KnowledgeBaseUpdateRequest,
  KnowledgeDocumentCompleteRequest,
  KnowledgeDocumentDownloadUrlResponse,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentStatusResponse,
  KnowledgeDocumentUploadResponse,
  KnowledgeDocumentUploadUrlRequest,
  KnowledgeDocumentUploadUrlResponse,
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

export async function uploadKnowledgeDocument(
  scope: KnowledgeScope,
  knowledgeBaseId: string,
  file: File,
  userId?: string,
): Promise<KnowledgeDocumentUploadResponse> {
  const path = `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents`;
  const intentBody: KnowledgeDocumentUploadUrlRequest = {
    filename: file.name,
    size_bytes: file.size,
  };
  const intent = await request<KnowledgeDocumentUploadUrlResponse>(`${path}/upload-url`, {
    method: 'POST',
    body: intentBody,
  });
  const upload = await fetch(intent.upload_url, {
    method: 'PUT',
    headers: intent.headers,
    body: file,
  });
  if (!upload.ok) {
    throw new Error(`上传失败（${upload.status}）`);
  }
  const completeBody: KnowledgeDocumentCompleteRequest = {
    upload_id: intent.upload_id,
    filename: file.name,
    size_bytes: file.size,
    content_type: file.type || null,
  };
  return request<KnowledgeDocumentUploadResponse>(`${path}/complete`, {
    method: 'POST',
    body: completeBody,
  });
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
  const result = await request<KnowledgeDocumentDownloadUrlResponse>(
    `${basePath(scope, userId)}/${encodeURIComponent(knowledgeBaseId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
  const anchor = document.createElement('a');
  anchor.href = result.url;
  anchor.download = result.filename || filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
