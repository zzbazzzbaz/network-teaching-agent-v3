import { API_BASE } from '@/lib/config';
import { recordMetric } from '@/lib/metrics';
import { readAuthTokens, writeAuthTokens } from '@/lib/storage';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type AuthFailureReason = 'expired' | 'disabled';

let authFailureHandler: (reason: AuthFailureReason) => void = () => {};

export function setAuthFailureHandler(handler: (reason: AuthFailureReason) => void): void {
  authFailureHandler = handler;
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  auth?: boolean;
}

interface RawResponse {
  status: number;
  ok: boolean;
  payload: unknown;
}

export function getAccessToken(): string | null {
  return readAuthTokens()?.accessToken ?? null;
}

export function getApiBase(): string {
  return API_BASE;
}

function buildHeaders(options: RequestOptions, token: string | null): Headers {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined && options.formData === undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function extractDetail(payload: unknown, status: number): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail) {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === 'object' && typeof (item as { msg?: unknown }).msg === 'string'
            ? (item as { msg: string }).msg
            : null,
        )
        .filter((item): item is string => Boolean(item));
      if (messages.length > 0) {
        return messages.join('；');
      }
    }
  }
  return `请求失败（${status}）`;
}

async function readResponse(response: Response): Promise<RawResponse> {
  if (response.status === 204) {
    return { status: response.status, ok: response.ok, payload: undefined };
  }
  const text = await response.text();
  if (!text) {
    return { status: response.status, ok: response.ok, payload: undefined };
  }
  try {
    return { status: response.status, ok: response.ok, payload: JSON.parse(text) };
  } catch {
    return { status: response.status, ok: response.ok, payload: text };
  }
}

let refreshInFlight: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const current = readAuthTokens();
  if (!current) {
    throw new ApiError(401, '登录已过期');
  }
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });
  const result = await readResponse(response);
  if (!result.ok) {
    const detail = extractDetail(result.payload, result.status);
    if (result.status === 403 && detail === '账号不可用') {
      writeAuthTokens(null);
      authFailureHandler('disabled');
    } else if (result.status !== 403) {
      writeAuthTokens(null);
      authFailureHandler('expired');
    }
    throw new ApiError(result.status, detail);
  }
  const payload = result.payload as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  writeAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  });
  return payload.access_token;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<RawResponse> {
  const startedAt = performance.now();
  const { formData, body, ...init } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(options, token),
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const result = await readResponse(response);
  const elapsed = Math.round(performance.now() - startedAt);
  if (import.meta.env.DEV) {
    console.warn('[api]', options.method ?? 'GET', path, result.status, `${elapsed}ms`);
  }
  if (!result.ok) {
    recordMetric('api_error_total', 1, { status: result.status, path });
  }
  return result;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  let token = useAuth ? getAccessToken() : null;
  let result = await send(path, options, token);

  if (result.status === 401 && useAuth) {
    try {
      token = await refreshAccessToken();
    } catch {
      throw new ApiError(401, '登录已过期，请重新登录');
    }
    result = await send(path, options, token);
  }

  if (!result.ok) {
    const detail = extractDetail(result.payload, result.status);
    if (result.status === 403 && useAuth && detail === '账号不可用') {
      writeAuthTokens(null);
      authFailureHandler('disabled');
    }
    throw new ApiError(result.status, detail);
  }

  return result.payload as T;
}

export function toErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
