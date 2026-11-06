export interface PutFileParams {
  url: string;
  headers: Record<string, string>;
  file: File;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

export function putFileWithProgress({
  url,
  headers,
  file,
  onProgress,
  signal,
}: PutFileParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException('上传已取消', 'AbortError'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });

    const cleanup = () => {
      signal.removeEventListener('abort', abortHandler);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`上传失败（${xhr.status}）`));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('网络错误，上传失败'));
    };
    xhr.onabort = () => {
      cleanup();
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('上传超时'));
    };

    xhr.send(file);
  });
}
