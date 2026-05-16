import { request } from '../../lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  htPlayerId: number;
  firstName: string;
  lastName: string;
  currentHtTeamId: number | null;
  age: number | null;
  ageDays: number | null;
  countryId: number | null;
  countryCode: string | null;
  countryName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerTeamHistoryEntry {
  htTeamId: number;
  teamName: string;
  logoUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PlayerMatchStat {
  tournamentId: string;
  tournamentName: string;
  matchId: string;
  htMatchId: number | null;
  round: number | null;
  matchDate: string | null;
  htTeamId: number;
  teamName: string;
  opponentHtTeamId: number | null;
  opponentTeamName: string;
  isHome: boolean;
  roleId: number;
  minuteIn: number;
  minuteOut: number | null;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ratingStars: number | null;
}

export interface PlayerCareerTotals {
  matches: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgMinutes: number;
  avgRating: number | null;
  bestRating: number | null;
}

export interface PlayerDetail {
  player: Player;
  teamHistory: PlayerTeamHistoryEntry[];
  matchStats: PlayerMatchStat[];
  totals: PlayerCareerTotals;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const playersApi = {
  get(htPlayerId: number): Promise<PlayerDetail> {
    return request<PlayerDetail>(`/players/${htPlayerId}`);
  },

  uploadAvatar(htPlayerId: number, file: File): Promise<{ avatarUrl: string }> {
    const token = localStorage.getItem('token');
    const body = new FormData();
    body.append('avatar', file);
    return fetch(`/api/players/${htPlayerId}/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    }).then((r) => r.json());
  },

  deleteAvatar(htPlayerId: number): Promise<void> {
    const token = localStorage.getItem('token');
    return fetch(`/api/players/${htPlayerId}/avatar`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(() => undefined);
  },
};
