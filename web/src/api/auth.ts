import { request } from './client';
import type { AuthResponse, UserResponse } from './types';

export function login(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
}

export function fetchMe(): Promise<UserResponse> {
  return request<UserResponse>('/auth/me');
}
