import { create } from 'zustand';

import { fetchMe, login as loginRequest } from '@/api/auth';
import { setAuthFailureHandler } from '@/api/client';
import type { UserResponse } from '@/api/types';
import { queryClient } from '@/lib/query-client';
import { readAuthTokens, writeAuthTokens } from '@/lib/storage';

import { useChatStore } from './chat-store';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: UserResponse | null;
  notice: string | null;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setNotice: (notice: string | null) => void;
}

function clearSession(): void {
  writeAuthTokens(null);
  queryClient.clear();
  useChatStore.getState().reset();
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  notice: null,

  async bootstrap() {
    const tokens = readAuthTokens();
    if (!tokens) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    try {
      const user = await fetchMe();
      set({ status: 'authenticated', user });
    } catch {
      clearSession();
      set({ status: 'unauthenticated', user: null });
    }
  },

  async login(username, password) {
    const tokens = await loginRequest(username, password);
    writeAuthTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
    const user = await fetchMe();
    set({ status: 'authenticated', user, notice: null });
  },

  logout() {
    clearSession();
    set({ status: 'unauthenticated', user: null, notice: null });
  },

  setNotice(notice) {
    set({ notice });
  },
}));

setAuthFailureHandler((reason) => {
  clearSession();
  useAuthStore.setState({
    status: 'unauthenticated',
    user: null,
    notice: reason === 'disabled' ? '账号不可用，请联系老师' : '登录已过期，请重新登录',
  });
});
