import { request } from './client';
import type {
  AttemptListResponse,
  QuestionItem,
  QuestionListResponse,
  QuestionType,
} from './types';

export type QuestionScope = 'all' | 'mine';

export interface ListQuestionsParams {
  query?: string;
  question_type?: QuestionType;
  scope?: QuestionScope;
  date?: string;
  limit?: number;
  offset?: number;
}

export function listQuestions(params: ListQuestionsParams = {}): Promise<QuestionListResponse> {
  const search = new URLSearchParams();
  if (params.query) {
    search.set('query', params.query);
  }
  if (params.question_type) {
    search.set('question_type', params.question_type);
  }
  search.set('scope', params.scope ?? 'all');
  if (params.date) {
    search.set('date', params.date);
  }
  search.set('limit', String(params.limit ?? 20));
  search.set('offset', String(params.offset ?? 0));
  return request<QuestionListResponse>(`/questions?${search.toString()}`);
}

export function getQuestion(questionId: string): Promise<QuestionItem> {
  return request<QuestionItem>(`/questions/${encodeURIComponent(questionId)}`);
}

export function listAttempts(
  questionId: string,
  limit = 20,
  offset = 0,
): Promise<AttemptListResponse> {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<AttemptListResponse>(
    `/questions/${encodeURIComponent(questionId)}/attempts?${search.toString()}`,
  );
}
