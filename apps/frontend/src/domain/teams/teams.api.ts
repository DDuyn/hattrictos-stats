import { request } from '../../lib/api-client';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

// ─── Types (mirror the backend row shapes) ────────────────────────────────────

export interface Team {
  id: string;
  htTeamId: number;
  name: string;
  shortName: string;
  managerLoginName: string;
  leagueName: string;
  arenaName: string;
  foundedDate: string;
  /** Ruta relativa al logo del equipo (ej. /logos/12345.png). Null si no tiene logo. */
  logoUrl: string | null;
}

export interface TeamWithTournaments extends Team {
  tournaments: { id: string; name: string; season: number | null }[];
}

export interface TeamTournamentStat {
  tournamentId: string;
  tournamentName: string;
  season: number | null;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TeamPlayer {
  id: string;
  htPlayerId: number;
  firstName: string;
  lastName: string;
  currentHtTeamId: number;
  age: number | null;
  ageDays: number | null;
  countryId: number | null;
  countryCode: string | null;
  countryName: string | null;
}

export interface RecentMatch {
  id: string;
  tournamentId: string;
  tournamentName?: string;
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

export interface TeamGlobalStats {
  totalPlayed: number;
  totalWon: number;
  totalDrawn: number;
  totalLost: number;
  totalGoalsFor: number;
  totalGoalsAgainst: number;
}

export interface PlayerStat {
  htPlayerId: number;
  firstName: string;
  lastName: string;
  value: number;
  yellows?: number;
  reds?: number;
}

export interface TeamSeasonStats {
  tournamentId: string;
  tournamentName: string;
  season: number | null;
  topScorers: PlayerStat[];
  topMinutes: PlayerStat[];
  topCards: PlayerStat[];
}

export interface TeamDetail {
  team: Team;
  tournaments: TeamTournamentStat[];
  roster: TeamPlayer[];
  matches: RecentMatch[];
  globalStats: TeamGlobalStats;
  topScorers: PlayerStat[];
  topMinutes: PlayerStat[];
  topCards: PlayerStat[];
  currentSeason: TeamSeasonStats | null;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const teamsApi = {
  /** List all teams with their tournament memberships */
  list: () => request<TeamWithTournaments[]>('/teams'),

  /** Get full detail for a team by its Hattrick team ID */
  get: (htTeamId: number) => request<TeamDetail>(`/teams/${htTeamId}`),

  /**
   * Upload a logo for a team (PNG, JPG or SVG, max 500 KB).
   * Uses FormData — NOT the generic request() to avoid Content-Type conflicts.
   * Requires staff role (token sent via Authorization header).
   */
  uploadLogo: async (htTeamId: number, file: File): Promise<{ logoUrl: string }> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch(`${API_BASE}/teams/${htTeamId}/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  /**
   * Delete the logo for a team.
   * Requires staff role.
   */
  deleteLogo: (htTeamId: number) =>
    request<void>(`/teams/${htTeamId}/logo`, { method: 'DELETE' }),
};
