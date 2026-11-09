import { request } from './client';
import type {
  QuestionRecordDetail,
  QuestionRecordListResponse,
  QuestionType,
} from './types';

export interface ListQuestionsParams {
  query?: string;
  question_type?: QuestionType;
  date?: string;
  limit?: number;
  offset?: number;
}

export function listQuestions(
  params: ListQuestionsParams = {},
): Promise<QuestionRecordListResponse> {
  const search = new URLSearchParams();
  if (params.query) {
    search.set('query', params.query);
  }
  if (params.question_type) {
    search.set('question_type', params.question_type);
  }
  if (params.date) {
    search.set('date', params.date);
  }
  search.set('limit', String(params.limit ?? 20));
  search.set('offset', String(params.offset ?? 0));
  return request<QuestionRecordListResponse>(`/questions?${search.toString()}`);
}

export function getQuestion(questionId: string): Promise<QuestionRecordDetail> {
  return request<QuestionRecordDetail>(`/questions/${encodeURIComponent(questionId)}`);
}
