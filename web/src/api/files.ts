import { request } from './client';
import type { FileUploadResponse, UploadUrlResponse } from './types';

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

export function completeUpload(fileId: string): Promise<FileUploadResponse> {
  return request<FileUploadResponse>(`/files/${encodeURIComponent(fileId)}/complete`, {
    method: 'POST',
  });
}
