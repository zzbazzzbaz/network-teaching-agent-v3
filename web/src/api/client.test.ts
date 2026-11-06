import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HTTP 客户端', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    window.localStorage.setItem(
      'app.auth.v1',
      JSON.stringify({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 1000,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('并发 401 只触发一次刷新', async () => {
    let refreshCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        return jsonResponse({
          access_token: 'fresh-token',
          refresh_token: 'refresh-token-2',
          token_type: 'bearer',
          expires_in: 1800,
        });
      }
      const authorization = new Headers(init?.headers).get('Authorization');
      if (authorization === 'Bearer expired-token') {
        return jsonResponse({ detail: '未认证或登录已过期' }, 401);
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { request } = await import('./client');
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request<{ ok: boolean }>('/sessions')),
    );

    expect(results.every((item) => item.ok)).toBe(true);
    expect(refreshCount).toBe(1);
    const stored = JSON.parse(window.localStorage.getItem('app.auth.v1') ?? '{}');
    expect(stored.accessToken).toBe('fresh-token');
  });

  it('刷新失败清理令牌并通知登出', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse({ detail: '未认证或登录已过期' }, 401);
      }
      return jsonResponse({ detail: '未认证或登录已过期' }, 401);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { request, setAuthFailureHandler, ApiError } = await import('./client');
    const handler = vi.fn();
    setAuthFailureHandler(handler);

    await expect(request('/sessions')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledWith('expired');
    expect(window.localStorage.getItem('app.auth.v1')).toBeNull();
  });

  it('403 视为账号不可用', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ detail: '无访问权限' }, 403));
    vi.stubGlobal('fetch', fetchMock);

    const { request, setAuthFailureHandler } = await import('./client');
    const handler = vi.fn();
    setAuthFailureHandler(handler);

    await expect(request('/sessions')).rejects.toMatchObject({ status: 403 });
    expect(handler).toHaveBeenCalledWith('disabled');
  });
});
