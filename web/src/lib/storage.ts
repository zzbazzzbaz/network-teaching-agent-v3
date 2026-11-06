const AUTH_KEY = 'app.auth.v1';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function isAuthTokens(value: unknown): value is AuthTokens {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number'
  );
}

export function readAuthTokens(): AuthTokens | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isAuthTokens(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAuthTokens(tokens: AuthTokens | null): void {
  try {
    if (tokens === null) {
      window.localStorage.removeItem(AUTH_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
  } catch {
    // 隐私模式下 localStorage 写入会抛错，令牌只留在内存里也不阻塞登录
  }
}
