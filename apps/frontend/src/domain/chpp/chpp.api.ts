import { request } from '../../lib/api-client';

export const chppApi = {
  connect: () =>
    request<{ authorizeUrl: string }>('/admin/chpp/connect'),

  verify: () =>
    request<{ teamId: number | null; teamName: string | null; htLoginName: string | null; htUserId: string | null }>('/admin/chpp/verify'),


  getMatch: (matchId: string) =>
    request<{ data: unknown }>(`/admin/chpp/match/${matchId}`),

  getTournament: (tournamentId: string) =>
    request<{ data: unknown }>(`/admin/chpp/tournament/${tournamentId}`),

  getTournamentFixtures: (tournamentId: string) =>
    request<{ data: unknown }>(`/admin/chpp/tournament/${tournamentId}/fixtures`),

  getTournamentLeagueTable: (tournamentId: string) =>
    request<{ data: unknown }>(`/admin/chpp/tournament/${tournamentId}/table`),
};
