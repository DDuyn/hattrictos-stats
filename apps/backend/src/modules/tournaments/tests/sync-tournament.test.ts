import { describe, it, expect } from 'bun:test';
import { parseStandings } from '../use-cases/sync-tournament';

describe('parseStandings', () => {
  it('reads draws from alternate CHPP field names', () => {
    const result = parseStandings('tournament-1', {
      HattrickData: {
        TournamentLeagueTables: {
          TournamentLeagueTable: {
            GroupId: 1,
            Teams: {
              Team: {
                TeamID: 2862614,
                TeamName: 'The Good Radiants',
                GamesPlayed: 12,
                Won: 2,
                Draws: 2,
                Lost: 8,
                GoalsFor: 13,
                GoalsAgainst: 26,
                Points: 8,
              },
            },
          },
        },
      },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.drawn).toBe(2);
  });

  it('derives draws from played minus won and lost when draw field missing', () => {
    const result = parseStandings('tournament-1', {
      HattrickData: {
        TournamentLeagueTables: {
          TournamentLeagueTable: {
            GroupId: 1,
            Teams: {
              Team: {
                TeamID: 2862614,
                TeamName: 'The Good Radiants',
                GamesPlayed: 12,
                Won: 2,
                Lost: 8,
                GoalsFor: 13,
                GoalsAgainst: 26,
                Points: 8,
              },
            },
          },
        },
      },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.drawn).toBe(2);
  });
});
