import { request } from '../../lib/api-client';
import type { ContactInput } from '@hattrictos-stats/shared';

export interface ContactResponse {
  issueNumber: number;
  issueUrl: string;
}

export const contactApi = {
  send: (input: ContactInput) =>
    request<ContactResponse>('/contact', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
