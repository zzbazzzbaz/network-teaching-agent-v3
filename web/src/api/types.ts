import type { Msg } from '@agentscope-ai/agentscope/message';

export type AgentKind = 'teach_agent' | 'exp_agent' | 'exam_agent';
export type QuestionType = 'single_choice' | 'short_answer';
export type UserRole = 'student' | 'admin';
export type FileStatus = 'pending' | 'ready';
export type SessionStatus = 'running' | 'idle' | 'awaiting_permission' | 'awaiting_external_result';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface UserResponse {
  id: string;
  username: string;
  status: 'active' | 'disabled';
  role: UserRole;
  created_at: string;
}

export interface SessionItem {
  id: string;
  agent_kind: AgentKind;
  title: string;
  knowledge_base_ids: string[];
  last_message_at: string | null;
  created_at: string;
}

export type KnowledgeVisibility = 'private' | 'public';
export type KnowledgeDocumentStatus =
  | 'pending'
  | 'parsing'
  | 'chunking'
  | 'indexing'
  | 'ready'
  | 'error';

export interface KnowledgeStatusCounts {
  pending: number;
  parsing: number;
  chunking: number;
  indexing: number;
  ready: number;
  error: number;
}

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string;
  visibility: KnowledgeVisibility;
  editable: boolean;
  document_count: number;
  chunk_count: number;
  status_counts: KnowledgeStatusCounts;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseListResponse {
  items: KnowledgeBaseItem[];
  total: number;
}

export interface KnowledgeBaseCreateRequest {
  name: string;
  description?: string;
}

export interface KnowledgeBaseUpdateRequest {
  name?: string;
  description?: string;
}

export interface KnowledgeDocumentItem {
  id: string;
  filename: string;
  size: number;
  content_type: string | null;
  status: KnowledgeDocumentStatus;
  error: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentListResponse {
  items: KnowledgeDocumentItem[];
  total: number;
}

export interface KnowledgeDocumentStatusResponse {
  items: KnowledgeDocumentItem[];
}

export interface KnowledgeDocumentUploadResponse {
  id: string;
  filename: string;
  status: KnowledgeDocumentStatus;
}

export interface SessionListResponse {
  items: SessionItem[];
  total: number;
}

export interface MessageAttachmentPayload {
  file_id: string;
}

export interface SendMessageRequest {
  text: string;
  attachments: MessageAttachmentPayload[];
}

export interface SendMessageResponse {
  status: string;
  session_id: string;
}

export interface MessageListResponse {
  messages: Msg[];
  event_cursor: string | null;
  is_running: boolean;
  has_more: boolean;
}

export interface SessionStatusResponse {
  session_id: string;
  status: SessionStatus;
}

export interface MemoryEntry {
  id: string;
  kind: 'daily' | 'digest';
  title: string;
  summary: string;
  date: string | null;
  session_id: string | null;
  session_title: string | null;
  updated_at: string;
}

export interface MemoryEntryDetail extends MemoryEntry {
  content: string;
  content_truncated: boolean;
}

export interface MemoryEntryListResponse {
  items: MemoryEntry[];
  total: number;
  has_more: boolean;
  truncated: boolean;
}

export interface QuestionRecordItem {
  id: string;
  question_type: QuestionType;
  stem: string;
  student_answer: string;
  correct_answer: string;
  session_id: string;
  answered_at: string;
}

export interface QuestionRecordDetail extends QuestionRecordItem {
  options: Record<string, string> | null;
}

export interface QuestionRecordListResponse {
  items: QuestionRecordItem[];
  total: number;
}

export interface StatsTotals {
  tokens: number;
  sessions: number;
  rounds: number;
  answers: number;
}

export interface DailyStatsItem {
  date: string;
  tokens: number;
  cache_hit_rate: number | null;
  rounds: number;
  input_tokens: number;
  output_tokens: number;
  cache_input_tokens: number;
}

export interface MyStatsResponse {
  totals: StatsTotals;
  daily: DailyStatsItem[];
}

export interface UploadUrlResponse {
  file_id: string;
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
  thumb_upload_url: string | null;
  expires_in: number;
}

export interface FileItem {
  id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  has_thumb: boolean;
  thumb_url: string | null;
  preview_url: string;
  created_at: string;
}

export interface FileDetail extends FileItem {
  session_id: string;
  status: FileStatus;
  download_url: string;
}

export interface FileListResponse {
  items: FileItem[];
  total: number;
}

export interface ExternalExecutionResultPayload {
  type: 'EXTERNAL_EXECUTION_RESULT';
  reply_id: string;
  execution_results: Array<{
    type: 'tool_result';
    id: string;
    name: string;
    output: string;
    state: 'success';
    metadata: Record<string, unknown>;
  }>;
}

export interface UserConfirmResultPayload {
  type: 'USER_CONFIRM_RESULT';
  reply_id: string;
  confirm_results: Array<{
    confirmed: boolean;
    tool_call: { id: string; name: string; input: string; type: 'tool_call' };
  }>;
}

export interface AdminUserItem {
  id: string;
  username: string;
  role: UserRole;
  status: 'active' | 'disabled';
  created_at: string;
  last_active_at: string | null;
  sessions: number;
  rounds: number;
  tokens: number;
  answers: number;
}

export interface AdminUserListResponse {
  items: AdminUserItem[];
  total: number;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  role: UserRole;
  status: 'active' | 'disabled';
  created_at: string;
  last_active_at: string | null;
}

export interface AdminUserCreateRequest {
  username: string;
  status: 'active' | 'disabled';
}

export interface AdminUserStatusRequest {
  status: 'active' | 'disabled';
}

export interface AdminOverviewDailyItem {
  date: string;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_input_tokens: number;
  cache_hit_rate: number | null;
  rounds: number;
  answers: number;
  active_students: number;
  new_students: number;
}

export interface AdminOverviewResponse {
  students_total: number;
  students_active: number;
  students_new: number;
  sessions: number;
  rounds: number;
  answers: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_input_tokens: number;
  cache_hit_rate: number | null;
  daily: AdminOverviewDailyItem[];
}

export interface AdminUserRankingItem {
  user_id: string;
  username: string;
  tokens: number;
  rounds: number;
  answers: number;
  sessions: number;
  last_active_at: string | null;
}

export interface AdminUserRankingResponse {
  items: AdminUserRankingItem[];
}
