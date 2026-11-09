import { request } from './client';
import type { SessionItem, SessionListResponse, SessionStatusResponse } from './types';

export interface ListSessionsParams {
  limit?: number;
  offset?: number;
  include_empty?: boolean;
}

export function listSessions(params: ListSessionsParams = {}): Promise<SessionListResponse> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 20));
  search.set('offset', String(params.offset ?? 0));
  if (params.include_empty) {
    search.set('include_empty', 'true');
  }
  return request<SessionListResponse>(`/sessions?${search.toString()}`);
}

export function createSession(knowledgeBaseIds?: string[]): Promise<SessionItem> {
  return request<SessionItem>('/sessions', {
    method: 'POST',
    body:
      knowledgeBaseIds === undefined
        ? {}
        : { knowledge_base_ids: knowledgeBaseIds },
  });
}

export function getSession(sessionId: string): Promise<SessionItem> {
  return request<SessionItem>(`/sessions/${encodeURIComponent(sessionId)}`);
}

export function deleteSession(sessionId: string): Promise<void> {
  return request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export function stopSession(sessionId: string): Promise<{ session_id: string }> {
  return request<{ session_id: string }>(`/sessions/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
  });
}

export function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  return request<SessionStatusResponse>(`/sessions/${encodeURIComponent(sessionId)}/status`);
}
