import { request } from '../../lib/api-client';

export interface HomeAnnouncement {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

export interface HomeStandingRow {
  position: number;
  htTeamId: number;
  teamName: string;
  logoUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  groupId: string | null;
}

export interface HomeMatch {
  id: string;
  htMatchId: number | null;
  round: number;
  matchDate: string | null;
  homeTeamId: number;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamLogo: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  detailsSynced: boolean;
}

export interface HomeTournament {
  id: string;
  name: string;
  season: number | null;
  tournamentType: string | null;
  standings: HomeStandingRow[];
  lastRound: { round: number; matches: HomeMatch[] } | null;
  nextRound: { round: number; matches: HomeMatch[] } | null;
}

export interface HomePressNote {
  id: string;
  htTeamId: number;
  teamName: string | null;
  teamLogo: string | null;
  authorName: string;
  title: string;
  createdAt: string;
}

export interface HomeData {
  announcements: HomeAnnouncement[];
  tournaments: HomeTournament[];
  pressNotes: HomePressNote[];
}

export const homeApi = {
  get: () => request<HomeData>('/home'),
};
