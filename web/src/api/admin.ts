import { request } from './client';
import type { ListMemoryParams } from './memory';
import type {
  AdminAttemptListResponse,
  AdminOverviewResponse,
  AdminQuestionDetail,
  AdminQuestionListResponse,
  AdminQuestionPayload,
  AdminQuestionScope,
  AdminQuestionUpdatePayload,
  AdminUserCreateRequest,
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserRankingResponse,
  AdminUserUpdateRequest,
  MemoryEntryDetail,
  MemoryEntryListResponse,
  MessageListResponse,
  MyStatsResponse,
  QuestionType,
  SessionItem,
  SessionListResponse,
  UserRole,
} from './types';

export type AdminUserSort =
  | 'created_at_desc'
  | 'last_active_desc'
  | 'username_asc'
  | 'tokens_desc'
  | 'rounds_desc'
  | 'answers_desc'
  | 'sessions_desc';

export type AdminRankingSort = 'tokens' | 'rounds' | 'answers' | 'sessions';

export interface ListUsersParams {
  q?: string;
  role?: UserRole | 'all';
  status?: 'active' | 'disabled';
  sort?: AdminUserSort;
  limit?: number;
  offset?: number;
}

export interface ListAdminSessionsParams {
  q?: string;
  include_empty?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListAdminQuestionsParams {
  scope?: AdminQuestionScope;
  user_id?: string;
  q?: string;
  question_type?: QuestionType;
  date?: string;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

function appendParams(search: URLSearchParams, params: Record<string, unknown>): void {
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, String(value));
  });
}

export function listUsers(params: ListUsersParams = {}): Promise<AdminUserListResponse> {
  const search = new URLSearchParams();
  appendParams(search, {
    ...params,
    role: params.role ?? 'student',
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    sort: params.sort ?? 'created_at_desc',
  });
  return request<AdminUserListResponse>(`/admin/users?${search.toString()}`);
}

export function createUser(payload: AdminUserCreateRequest): Promise<AdminUserDetail> {
  return request<AdminUserDetail>('/admin/users', { method: 'POST', body: payload });
}

export function getUser(userId: string): Promise<AdminUserDetail> {
  return request<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`);
}

export function updateUser(
  userId: string,
  payload: AdminUserUpdateRequest,
): Promise<AdminUserDetail> {
  return request<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function resetPassword(userId: string, newPassword: string): Promise<void> {
  return request<void>(`/admin/users/${encodeURIComponent(userId)}/password`, {
    method: 'POST',
    body: { new_password: newPassword },
  });
}

export function getUserStats(userId: string, days: number): Promise<MyStatsResponse> {
  return request<MyStatsResponse>(
    `/admin/users/${encodeURIComponent(userId)}/stats?days=${days}`,
  );
}

export function listUserSessions(
  userId: string,
  params: ListAdminSessionsParams = {},
): Promise<SessionListResponse> {
  const search = new URLSearchParams();
  appendParams(search, {
    q: params.q,
    include_empty: params.include_empty,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
  return request<SessionListResponse>(
    `/admin/users/${encodeURIComponent(userId)}/sessions?${search.toString()}`,
  );
}

export function getUserSession(userId: string, sessionId: string): Promise<SessionItem> {
  return request<SessionItem>(
    `/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export function listUserMessages(
  userId: string,
  sessionId: string,
  before?: string,
  limit = 50,
): Promise<MessageListResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (before) {
    search.set('before', before);
  }
  return request<MessageListResponse>(
    `/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(
      sessionId,
    )}/messages?${search.toString()}`,
  );
}

export function listUserMemoryEntries(
  userId: string,
  params: ListMemoryParams,
): Promise<MemoryEntryListResponse> {
  const search = new URLSearchParams({ kind: params.kind });
  search.set('limit', String(params.limit ?? 20));
  search.set('offset', String(params.offset ?? 0));
  if (params.date) {
    search.set('date', params.date);
  }
  if (params.session_id) {
    search.set('session_id', params.session_id);
  }
  return request<MemoryEntryListResponse>(
    `/admin/users/${encodeURIComponent(userId)}/memory/entries?${search.toString()}`,
  );
}

export function getUserMemoryEntry(
  userId: string,
  entryId: string,
): Promise<MemoryEntryDetail> {
  return request<MemoryEntryDetail>(
    `/admin/users/${encodeURIComponent(userId)}/memory/entries/${encodeURIComponent(entryId)}`,
  );
}

export function getOverview(days: number): Promise<AdminOverviewResponse> {
  return request<AdminOverviewResponse>(`/admin/stats/overview?days=${days}`);
}

export function getUserRanking(
  days: number,
  sort: AdminRankingSort = 'tokens',
  limit = 20,
): Promise<AdminUserRankingResponse> {
  return request<AdminUserRankingResponse>(
    `/admin/stats/users?days=${days}&sort=${sort}&limit=${limit}`,
  );
}

export function listQuestions(
  params: ListAdminQuestionsParams = {},
): Promise<AdminQuestionListResponse> {
  const search = new URLSearchParams();
  appendParams(search, {
    ...params,
    scope: params.scope ?? 'all',
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });
  return request<AdminQuestionListResponse>(`/admin/questions?${search.toString()}`);
}

export function createQuestion(payload: AdminQuestionPayload): Promise<AdminQuestionDetail> {
  return request<AdminQuestionDetail>('/admin/questions', { method: 'POST', body: payload });
}

export function getQuestion(questionId: string): Promise<AdminQuestionDetail> {
  return request<AdminQuestionDetail>(`/admin/questions/${encodeURIComponent(questionId)}`);
}

export function updateQuestion(
  questionId: string,
  payload: AdminQuestionUpdatePayload,
): Promise<AdminQuestionDetail> {
  return request<AdminQuestionDetail>(`/admin/questions/${encodeURIComponent(questionId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteQuestion(questionId: string): Promise<void> {
  return request<void>(`/admin/questions/${encodeURIComponent(questionId)}`, {
    method: 'DELETE',
  });
}

export function listQuestionAttempts(
  questionId: string,
  limit = 20,
  offset = 0,
): Promise<AdminAttemptListResponse> {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<AdminAttemptListResponse>(
    `/admin/questions/${encodeURIComponent(questionId)}/attempts?${search.toString()}`,
  );
}
