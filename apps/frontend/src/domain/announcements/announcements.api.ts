import { request } from '../../lib/api-client';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  pinned: boolean;
  createdAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  pinned?: boolean;
}

export const announcementsApi = {
  list: () => request<Announcement[]>('/announcements'),

  create: (data: CreateAnnouncementInput) =>
    request<Announcement>('/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/announcements/${id}`, { method: 'DELETE' }),
};
