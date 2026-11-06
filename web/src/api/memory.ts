import { request } from './client';
import type { MemoryEntryDetail, MemoryEntryListResponse } from './types';

export interface ListMemoryParams {
  kind: 'daily' | 'digest';
  limit?: number;
  offset?: number;
  date?: string;
  session_id?: string;
}

export function listMemoryEntries(params: ListMemoryParams): Promise<MemoryEntryListResponse> {
  const search = new URLSearchParams({ kind: params.kind });
  search.set('limit', String(params.limit ?? 20));
  search.set('offset', String(params.offset ?? 0));
  if (params.date) {
    search.set('date', params.date);
  }
  if (params.session_id) {
    search.set('session_id', params.session_id);
  }
  return request<MemoryEntryListResponse>(`/memory/entries?${search.toString()}`);
}

export function getMemoryEntry(entryId: string): Promise<MemoryEntryDetail> {
  return request<MemoryEntryDetail>(`/memory/entries/${encodeURIComponent(entryId)}`);
}
