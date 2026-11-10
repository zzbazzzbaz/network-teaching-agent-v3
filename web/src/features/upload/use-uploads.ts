import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { completeUpload, requestUploadUrl } from '@/api/files';
import { toErrorMessage } from '@/api/client';
import { recordMetric } from '@/lib/metrics';

import { selectFiles } from './file-rules';
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
        const result = await completeUpload(ticket.file_id);
        patchItem(item.uid, { status: 'ready', fileId: result.file_id, percent: 100 });
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
      const { accepted, rejection } = selectFiles(Array.from(files), itemsRef.current.length);
      setError(rejection);
      if (accepted.length === 0) {
        return;
      }
      const staged: UploadItem[] = accepted.map((file) => ({
        uid: itemId(),
        name: file.name,
        size: file.size,
        status: 'uploading',
        percent: 0,
        fileId: null,
        previewUrl: URL.createObjectURL(file),
        error: null,
        file,
      }));
      setItems((current) => [...current, ...staged]);
      staged.forEach((item) => {
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
