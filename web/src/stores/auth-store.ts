import { create } from 'zustand';

import { fetchMe, login as loginRequest } from '@/api/auth';
import { setAuthFailureHandler } from '@/api/client';
import type { UserResponse } from '@/api/types';
import { isDefaultPassword } from '@/lib/password';
import { queryClient } from '@/lib/query-client';
import {
  readAuthTokens,
  readPasswordChangeRequired,
  writeAuthTokens,
  writePasswordChangeRequired,
} from '@/lib/storage';

import { useChatStore } from './chat-store';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: UserResponse | null;
  notice: string | null;
  mustChangePassword: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setNotice: (notice: string | null) => void;
  updateUser: (user: UserResponse) => void;
  markPasswordChangeRequired: () => void;
  clearPasswordChangeRequirement: () => void;
}

function clearSession(): void {
  writeAuthTokens(null);
  writePasswordChangeRequired(false);
  queryClient.clear();
  useChatStore.getState().reset();
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  notice: null,
  mustChangePassword: false,

  async bootstrap() {
    const tokens = readAuthTokens();
    if (!tokens) {
      writePasswordChangeRequired(false);
      set({ status: 'unauthenticated', user: null, mustChangePassword: false });
      return;
    }
    try {
      const user = await fetchMe();
      set({
        status: 'authenticated',
        user,
        mustChangePassword: readPasswordChangeRequired(),
      });
    } catch {
      clearSession();
      set({ status: 'unauthenticated', user: null, mustChangePassword: false });
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
    const mustChangePassword = isDefaultPassword(user.username, password);
    writePasswordChangeRequired(mustChangePassword);
    set({ status: 'authenticated', user, notice: null, mustChangePassword });
  },

  logout() {
    clearSession();
    set({
      status: 'unauthenticated',
      user: null,
      notice: null,
      mustChangePassword: false,
    });
  },

  setNotice(notice) {
    set({ notice });
  },

  updateUser(user) {
    set({ user });
  },

  markPasswordChangeRequired() {
    writePasswordChangeRequired(true);
    set({ mustChangePassword: true });
  },

  clearPasswordChangeRequirement() {
    writePasswordChangeRequired(false);
    set({ mustChangePassword: false });
  },
}));

setAuthFailureHandler((reason) => {
  clearSession();
  useAuthStore.setState({
    status: 'unauthenticated',
    user: null,
    mustChangePassword: false,
    notice: reason === 'disabled' ? '账号不可用，请联系老师' : '登录已过期，请重新登录',
  });
});
