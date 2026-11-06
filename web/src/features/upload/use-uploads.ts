import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { completeUpload, requestUploadUrl } from '@/api/files';
import { toErrorMessage } from '@/api/client';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_COUNT } from '@/lib/config';
import { recordMetric } from '@/lib/metrics';

import { putFileWithProgress } from './put-file';

export type UploadStatus = 'uploading' | 'completing' | 'ready' | 'error';

export interface UploadItem {
  uid: string;
  name: string;
  size: number;
  status: UploadStatus;
  percent: number;
  fileId: string | null;
  previewUrl: string;
  error: string | null;
  file: File;
}

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']);

function itemId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseUploadsResult {
  items: UploadItem[];
  error: string | null;
  readyIds: string[];
  canSend: boolean;
  addFiles: (files: File[] | FileList) => void;
  removeItem: (uid: string) => void;
  retryItem: (uid: string) => void;
  clear: () => void;
  detach: () => void;
  clearError: () => void;
}

export function useUploads(sessionId: string | null): UseUploadsResult {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controllersRef = useRef(new Map<string, AbortController>());
  const itemsRef = useRef<UploadItem[]>([]);

  itemsRef.current = items;

  useEffect(() => {
    return () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  }, [sessionId]);

  const patchItem = useCallback((uid: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.uid === uid ? { ...item, ...patch } : item)));
  }, []);

  const runUpload = useCallback(
    async (item: UploadItem, session: string) => {
      const controller = new AbortController();
      controllersRef.current.set(item.uid, controller);
      patchItem(item.uid, { status: 'uploading', percent: 0, error: null });
      try {
        const ticket = await requestUploadUrl({
          session_id: session,
          filename: item.name,
          size_bytes: item.size,
        });
        if (controller.signal.aborted) {
          return;
        }
        patchItem(item.uid, { fileId: ticket.file_id });
        await putFileWithProgress({
          url: ticket.upload_url,
          headers: ticket.headers,
          file: item.file,
          signal: controller.signal,
          onProgress: (percent) => patchItem(item.uid, { percent }),
        });
        patchItem(item.uid, { status: 'completing', percent: 100 });
        const detail = await completeUpload(ticket.file_id);
        patchItem(item.uid, { status: 'ready', fileId: detail.id, percent: 100 });
      } catch (uploadError) {
        if (uploadError instanceof DOMException && uploadError.name === 'AbortError') {
          return;
        }
        recordMetric('upload_fail_total', 1, { reason: item.name.split('.').pop() ?? 'unknown' });
        patchItem(item.uid, {
          status: 'error',
          error: toErrorMessage(uploadError, '上传失败，可重试'),
        });
      } finally {
        controllersRef.current.delete(item.uid);
      }
    },
    [patchItem],
  );

  const addFiles = useCallback(
    (files: File[] | FileList) => {
      if (!sessionId) {
        return;
      }
      const incoming = Array.from(files);
      setError(null);

      const accepted: UploadItem[] = [];
      let rejection: string | null = null;

      for (const file of incoming) {
        if (!ALLOWED_TYPES.has(file.type)) {
          rejection = '只支持 PNG、JPG、WebP、GIF、BMP 图片';
          continue;
        }
        if (file.size > UPLOAD_MAX_BYTES) {
          rejection = '单张图片不能超过 100MB';
          continue;
        }
        accepted.push({
          uid: itemId(),
          name: file.name,
          size: file.size,
          status: 'uploading',
          percent: 0,
          fileId: null,
          previewUrl: URL.createObjectURL(file),
          error: null,
          file,
        });
      }

      if (accepted.length === 0) {
        setError(rejection);
        return;
      }

      const currentCount = itemsRef.current.length;
      const remaining = Math.max(UPLOAD_MAX_COUNT - currentCount, 0);
      if (accepted.length > remaining) {
        rejection = `单条消息最多 ${UPLOAD_MAX_COUNT} 张图片`;
        accepted.splice(remaining);
      }

      if (accepted.length === 0) {
        setError(rejection ?? `单条消息最多 ${UPLOAD_MAX_COUNT} 张图片`);
        return;
      }

      setError(rejection);
      setItems((current) => [...current, ...accepted]);
      accepted.forEach((item) => {
        void runUpload(item, sessionId);
      });
    },
    [runUpload, sessionId],
  );

  const removeItem = useCallback((uid: string) => {
    controllersRef.current.get(uid)?.abort();
    controllersRef.current.delete(uid);
    setItems((current) => {
      const target = current.find((item) => item.uid === uid);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.uid !== uid);
    });
  }, []);

  const retryItem = useCallback(
    (uid: string) => {
      if (!sessionId) {
        return;
      }
      const item = itemsRef.current.find((candidate) => candidate.uid === uid);
      if (!item) {
        return;
      }
      void runUpload(item, sessionId);
    },
    [runUpload, sessionId],
  );

  const clear = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setError(null);
  }, []);

  const detach = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    setItems((current) => {
      current.forEach((item) => {
        window.setTimeout(() => URL.revokeObjectURL(item.previewUrl), 10 * 60 * 1000);
      });
      return [];
    });
    setError(null);
  }, []);

  const readyIds = useMemo(
    () =>
      items
        .filter((item) => item.status === 'ready' && item.fileId)
        .map((item) => item.fileId as string),
    [items],
  );

  const canSend = items.every((item) => item.status === 'ready');

  return {
    items,
    error,
    readyIds,
    canSend,
    addFiles,
    removeItem,
    retryItem,
    clear,
    detach,
    clearError: () => setError(null),
  };
}
