import { request } from '../../lib/api-client';
import type { AuthResponse, LoginInput, CreateUserInput, CreateUserResponse, ChangePasswordInput } from '@hattrictos-stats/shared';

export type UserProfile = AuthResponse['user'];

export const authApi = {
  login: (data: LoginInput) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => request<UserProfile>('/auth/me'),
  createUser: (data: CreateUserInput) =>
    request<CreateUserResponse>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  changePassword: (data: ChangePasswordInput) =>
    request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
