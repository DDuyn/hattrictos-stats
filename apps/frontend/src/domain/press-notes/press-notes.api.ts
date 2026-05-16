import { request } from '../../lib/api-client';

export interface PressNote {
  id: string;
  htTeamId: number;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface CreatePressNoteInput {
  title: string;
  content: string;
}

export const pressNotesApi = {
  list: (htTeamId: number) =>
    request<PressNote[]>(`/teams/${htTeamId}/press-notes`),

  create: (htTeamId: number, data: CreatePressNoteInput) =>
    request<PressNote>(`/teams/${htTeamId}/press-notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (htTeamId: number, noteId: string) =>
    request<void>(`/teams/${htTeamId}/press-notes/${noteId}`, {
      method: 'DELETE',
    }),
};
