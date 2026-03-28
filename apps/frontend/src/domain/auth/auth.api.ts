import { request } from '../../lib/api-client';
import type { AuthResponse, LoginInput, RegisterInput } from '@repo/shared';

export type UserProfile = AuthResponse['user'];

export const authApi = {
  login: (data: LoginInput) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  register: (data: RegisterInput) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => request<UserProfile>('/auth/me'),
};
