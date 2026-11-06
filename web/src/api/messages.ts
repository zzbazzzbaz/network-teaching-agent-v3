import { request } from './client';
import type {
  ExternalExecutionResultPayload,
  MessageListResponse,
  SendMessageRequest,
  SendMessageResponse,
  UserConfirmResultPayload,
} from './types';

export interface ListMessagesParams {
  before?: string;
  limit?: number;
}

export function listMessages(
  sessionId: string,
  params: ListMessagesParams = {},
): Promise<MessageListResponse> {
  const search = new URLSearchParams();
  if (params.before) {
    search.set('before', params.before);
  }
  search.set('limit', String(params.limit ?? 50));
  return request<MessageListResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/messages?${search.toString()}`,
  );
}

export function sendMessage(
  sessionId: string,
  payload: SendMessageRequest,
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: payload,
  });
}

export function submitSessionEvent(
  sessionId: string,
  payload: ExternalExecutionResultPayload | UserConfirmResultPayload,
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(`/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST',
    body: payload,
  });
}

export function streamPath(sessionId: string, after: string | null): string {
  const search = new URLSearchParams();
  if (after) {
    search.set('after', after);
  }
  const query = search.toString();
  const base = `/sessions/${encodeURIComponent(sessionId)}/stream`;
  return query ? `${base}?${query}` : base;
}
