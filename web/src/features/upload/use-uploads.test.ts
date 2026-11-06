import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/files', () => ({
  requestUploadUrl: vi.fn(),
  completeUpload: vi.fn(),
}));

import { completeUpload, requestUploadUrl } from '@/api/files';

import { useUploads } from './use-uploads';

class FakeXhr {
  static instances: FakeXhr[] = [];
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  status = 200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  aborted = false;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open() {}

  setRequestHeader() {}

  send() {
    setTimeout(() => {
      if (this.aborted) {
        return;
      }
      this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
      this.onload?.();
    }, 0);
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

function imageFile(name: string, size = 1024, type = 'image/png'): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('图片上传', () => {
  beforeEach(() => {
    FakeXhr.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.mocked(requestUploadUrl).mockReset();
    vi.mocked(requestUploadUrl).mockResolvedValue({
      file_id: 'file-1',
      upload_url: 'https://cos.example.com/put',
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      thumb_upload_url: null,
      expires_in: 600,
    });
    vi.mocked(completeUpload).mockReset();
    vi.mocked(completeUpload).mockResolvedValue({
      id: 'file-1',
      original_name: 'a.png',
      content_type: 'image/png',
      size_bytes: 1024,
      has_thumb: false,
      thumb_url: null,
      preview_url: 'https://cos.example.com/a.png',
      created_at: new Date().toISOString(),
      session_id: 'session-1',
      status: 'ready',
      download_url: 'https://cos.example.com/a.png',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('非图片在本地拦截，不发请求', async () => {
    const { result } = renderHook(() => useUploads('session-1'));
    act(() => {
      result.current.addFiles([new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
    });
    expect(requestUploadUrl).not.toHaveBeenCalled();
    expect(result.current.error).toContain('只支持');
  });

  it('超过 100MB 在本地拦截', () => {
    const { result } = renderHook(() => useUploads('session-1'));
    act(() => {
      result.current.addFiles([imageFile('huge.png', 104857601)]);
    });
    expect(requestUploadUrl).not.toHaveBeenCalled();
    expect(result.current.error).toContain('100MB');
  });

  it('超过 4 张只保留前 4 张', () => {
    const { result } = renderHook(() => useUploads('session-1'));
    act(() => {
      result.current.addFiles([
        imageFile('1.png'),
        imageFile('2.png'),
        imageFile('3.png'),
        imageFile('4.png'),
        imageFile('5.png'),
      ]);
    });
    expect(requestUploadUrl).toHaveBeenCalledTimes(4);
    expect(result.current.error).toContain('最多');
  });

  it('上传成功后进入 ready 并返回 file_id', async () => {
    const { result } = renderHook(() => useUploads('session-1'));
    act(() => {
      result.current.addFiles([imageFile('ok.png')]);
    });

    await waitFor(() => expect(result.current.items[0]?.status).toBe('ready'));
    expect(result.current.readyIds).toEqual(['file-1']);
    expect(completeUpload).toHaveBeenCalledWith('file-1');
  });

  it('单文件失败不影响其他文件', async () => {
    vi.mocked(requestUploadUrl)
      .mockRejectedValueOnce(new Error('签名过期'))
      .mockResolvedValueOnce({
        file_id: 'file-2',
        upload_url: 'https://cos.example.com/put-2',
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        thumb_upload_url: null,
        expires_in: 600,
      });

    const { result } = renderHook(() => useUploads('session-1'));
    act(() => {
      result.current.addFiles([imageFile('bad.png'), imageFile('good.png')]);
    });

    await waitFor(() => expect(result.current.items[0]?.status).toBe('error'));
    await waitFor(() => expect(result.current.items[1]?.status).toBe('ready'));
    expect(result.current.items[0]?.error).toContain('签名过期');
  });

  it('重试会重新申请上传地址', async () => {
    vi.mocked(requestUploadUrl).mockRejectedValueOnce(new Error('过期'));
    const { result } = renderHook(() => useUploads('session-1'));
    act(() => {
      result.current.addFiles([imageFile('retry.png')]);
    });
    await waitFor(() => expect(result.current.items[0]?.status).toBe('error'));

    act(() => {
      result.current.retryItem(result.current.items[0]!.uid);
    });

    await waitFor(() => expect(result.current.items[0]?.status).toBe('ready'));
    expect(requestUploadUrl).toHaveBeenCalledTimes(2);
  });
});
