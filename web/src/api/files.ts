import { request } from './client';
import type { FileDetail, FileItem, FileListResponse, UploadUrlResponse } from './types';

export interface UploadUrlRequest {
  session_id: string;
  filename: string;
  size_bytes: number;
}

export function requestUploadUrl(payload: UploadUrlRequest): Promise<UploadUrlResponse> {
  return request<UploadUrlResponse>('/files/upload-url', {
    method: 'POST',
    body: payload,
  });
}

export function completeUpload(fileId: string): Promise<FileDetail> {
  return request<FileDetail>(`/files/${encodeURIComponent(fileId)}/complete`, {
    method: 'POST',
  });
}

export function listFiles(sessionId: string, limit = 20, offset = 0): Promise<FileListResponse> {
  const search = new URLSearchParams({
    session_id: sessionId,
    limit: String(limit),
    offset: String(offset),
  });
  return request<FileListResponse>(`/files?${search.toString()}`);
}

export function getFile(fileId: string): Promise<FileDetail> {
  return request<FileDetail>(`/files/${encodeURIComponent(fileId)}`);
}

export function fileItemsToThumbMap(items: FileItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.thumb_url) {
      map.set(item.id, item.thumb_url);
    }
  }
  return map;
}
