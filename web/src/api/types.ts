import type { Msg } from '@agentscope-ai/agentscope/message';

export type AgentKind = 'teach_agent' | 'exp_agent';
export type QuestionType = 'single_choice' | 'short_answer';
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
  created_at: string;
}

export interface SessionItem {
  id: string;
  agent_kind: AgentKind;
  title: string;
  last_message_at: string | null;
  created_at: string;
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

export interface QuestionItem {
  id: string;
  user_id: string | null;
  stem: string;
  question_type: QuestionType;
  options: Record<string, string> | null;
  answer_text: string;
  note: string | null;
  created_at: string;
}

export interface QuestionListResponse {
  items: QuestionItem[];
  total: number;
}

export interface AttemptItem {
  id: string;
  question_id: string;
  session_id: string;
  tool_call_id: string | null;
  answer_text: string;
  created_at: string;
}

export interface AttemptListResponse {
  items: AttemptItem[];
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
