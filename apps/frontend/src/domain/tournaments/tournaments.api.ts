import { request } from '../../lib/api-client';

// ─── Types (mirror the backend row shapes) ────────────────────────────────────

export interface Tournament {
  id: string;
  htTournamentId: number;
  name: string;
  season: number | null;
  tournamentType: number | null;
  numberOfTeams: number | null;
  promotionSlots: number;
  relegationSlots: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface TournamentStanding {
  id: string;
  tournamentId: string;
  groupId: number;
  htTeamId: number;
  teamName: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  htMatchId: number;
  round: number;
  matchDate: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  detailsSynced: number;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  tournamentId: string;
  eventTypeId: number;
  minute: number;
  subjectPlayerId: number | null;
  subjectTeamId: number | null;
  objectPlayerId: number | null;
  subjectPlayerName: string | null;
  objectPlayerName: string | null;
}

export interface MatchAppearance {
  id: string;
  matchId: string;
  tournamentId: string;
  htPlayerId: number;
  htTeamId: number;
  roleId: number;
  behaviour: number;
  minuteIn: number;
  minuteOut: number | null;
  ratingStars: number | null;
  playerName: string;
  teamName: string;
}

export interface MatchDetail {
  match: TournamentMatch & { homeTeamName: string; awayTeamName: string };
  events: MatchEvent[];
  homeAppearances: MatchAppearance[];
  awayAppearances: MatchAppearance[];
}

export interface TopScorer {
  htPlayerId: number;
  playerName: string;
  htTeamId: number;
  teamName: string;
  goals: number;
}

export interface TopMinutes {
  htPlayerId: number;
  playerName: string;
  htTeamId: number;
  teamName: string;
  minutes: number;
  appearances: number;
}

export interface TournamentDetail {
  tournament: Tournament;
  standings: TournamentStanding[];
  matches: TournamentMatch[];
  topScorers: TopScorer[];
  topMinutes: TopMinutes[];
}

// ─── API client ───────────────────────────────────────────────────────────────

export const tournamentsApi = {
  // ── Public (no auth) ──────────────────────────────────────────────────────

  /** List all registered tournaments */
  list: () => request<Tournament[]>('/tournaments'),

  /** Get a tournament with standings + matches */
  get: (id: string) => request<TournamentDetail>(`/tournaments/${id}`),

  // ── Admin (requires owner/co_owner/admin JWT) ──────────────────────────────

  /** Register a new tournament by its Hattrick ID */
  register: (htTournamentId: number) =>
    request<{ id: string; htTournamentId: number; name: string }>('/admin/tournaments', {
      method: 'POST',
      body: JSON.stringify({ htTournamentId }),
    }),

  /** Force-sync a tournament's data from CHPP */
  sync: (id: string) =>
    request<{ synced: boolean }>(`/admin/tournaments/${id}/sync`, {
      method: 'POST',
    }),

  /** Get full match detail: result, events, and lineups */
  getMatch: (tournamentId: string, matchId: string) =>
    request<MatchDetail>(`/tournaments/${tournamentId}/matches/${matchId}`),

  /** Update promotion/relegation slots configuration */
  updateConfig: (id: string, config: { promotionSlots?: number; relegationSlots?: number }) =>
    request<{ updated: boolean }>(`/admin/tournaments/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),
};
