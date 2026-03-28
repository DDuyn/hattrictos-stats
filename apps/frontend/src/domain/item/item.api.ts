import { request } from '../../lib/api-client';
import type { ItemResponse, PaginatedResponse } from '@repo/shared';

export const itemsApi = {
  list: (page = 1, limit = 20) =>
    request<PaginatedResponse<ItemResponse>>(`/items?page=${page}&limit=${limit}`),
  get: (id: string) => request<ItemResponse>(`/items/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<ItemResponse>('/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<ItemResponse>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  activate: (id: string) =>
    request<ItemResponse>(`/items/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) =>
    request<ItemResponse>(`/items/${id}/deactivate`, { method: 'POST' }),
  delete: (id: string) => request<void>(`/items/${id}`, { method: 'DELETE' }),
};
