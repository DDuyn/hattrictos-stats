import { Hono } from 'hono';
import { desc, eq, isNotNull, asc } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { tournamentsTable, tournamentMatchesTable, tournamentStandingsTable } from '../tournaments/infrastructure/tournaments.table';
import { teamsTable } from '../teams/infrastructure/teams.table';
import { announcementsTable } from '../announcements/infrastructure/announcements.table';
import { createPressNotesRepository } from '../press-notes/infrastructure/press-notes.repository';

const app = new Hono();

/**
 * GET /api/home
 *
 * Returns aggregated data for the home dashboard:
 * - Pinned + recent announcements
 * - Per tournament: last played round results, next upcoming round, top-5 standings
 */
app.get('/', async (c) => {
  // ── Announcements ──────────────────────────────────────────────────────────
  const announcementRows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt))
    .limit(10)
    .all();

  const announcements = announcementRows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    pinned: r.pinned === 1,
    createdAt: r.createdAt,
  }));

  // ── Tournaments ────────────────────────────────────────────────────────────
  const tournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(asc(tournamentsTable.createdAt))
    .all();

  const tournamentSections = await Promise.all(
    tournaments.map(async (t) => {
      // Standings top 5 with team names
      const standingsRaw = await db
        .select({
          position: tournamentStandingsTable.position,
          htTeamId: tournamentStandingsTable.htTeamId,
          teamName: teamsTable.name,
          logoUrl: teamsTable.logoUrl,
          played: tournamentStandingsTable.played,
          won: tournamentStandingsTable.won,
          drawn: tournamentStandingsTable.drawn,
          lost: tournamentStandingsTable.lost,
          goalsFor: tournamentStandingsTable.goalsFor,
          goalsAgainst: tournamentStandingsTable.goalsAgainst,
          points: tournamentStandingsTable.points,
          groupId: tournamentStandingsTable.groupId,
        })
        .from(tournamentStandingsTable)
        .leftJoin(teamsTable, eq(tournamentStandingsTable.htTeamId, teamsTable.htTeamId))
        .where(eq(tournamentStandingsTable.tournamentId, t.id))
        .orderBy(
          asc(tournamentStandingsTable.groupId),
          asc(tournamentStandingsTable.position),
        )
        .all();

      const standings = standingsRaw.map((s) => ({
        position: s.position,
        htTeamId: s.htTeamId,
        teamName: s.teamName ?? String(s.htTeamId),
        logoUrl: s.logoUrl ?? null,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        points: s.points,
        groupId: s.groupId,
      }));

      // Last played round — max round with results
      const allMatchesRaw = await db
        .select({
          id: tournamentMatchesTable.id,
          round: tournamentMatchesTable.round,
          matchDate: tournamentMatchesTable.matchDate,
          homeTeamId: tournamentMatchesTable.homeTeamId,
          awayTeamId: tournamentMatchesTable.awayTeamId,
          homeGoals: tournamentMatchesTable.homeGoals,
          awayGoals: tournamentMatchesTable.awayGoals,
          status: tournamentMatchesTable.status,
          htMatchId: tournamentMatchesTable.htMatchId,
          detailsSynced: tournamentMatchesTable.detailsSynced,
        })
        .from(tournamentMatchesTable)
        .where(eq(tournamentMatchesTable.tournamentId, t.id))
        .orderBy(asc(tournamentMatchesTable.round), asc(tournamentMatchesTable.matchDate))
        .all();

      // Get team names map
      const teamIds = [
        ...new Set(allMatchesRaw.flatMap((m) => [m.homeTeamId, m.awayTeamId])),
      ];
      const teamRows =
        teamIds.length > 0
          ? await db
              .select({ htTeamId: teamsTable.htTeamId, name: teamsTable.name, logoUrl: teamsTable.logoUrl })
              .from(teamsTable)
              .all()
          : [];
      const teamMap = new Map(teamRows.map((t) => [t.htTeamId, t]));

      const playedMatches = allMatchesRaw.filter(
        (m) => m.homeGoals !== null && m.awayGoals !== null,
      );
      const upcomingMatches = allMatchesRaw.filter(
        (m) => m.homeGoals === null || m.awayGoals === null,
      );

      // Last round = highest round number among played matches
      const lastRound =
        playedMatches.length > 0
          ? Math.max(...playedMatches.map((m) => m.round))
          : null;
      const lastRoundMatches = lastRound !== null
        ? playedMatches.filter((m) => m.round === lastRound)
        : [];

      // Next round = lowest round number among upcoming matches
      const nextRound =
        upcomingMatches.length > 0
          ? Math.min(...upcomingMatches.map((m) => m.round))
          : null;
      const nextRoundMatches = nextRound !== null
        ? upcomingMatches.filter((m) => m.round === nextRound)
        : [];

      const formatMatch = (m: typeof allMatchesRaw[0]) => ({
        id: m.id,
        htMatchId: m.htMatchId,
        round: m.round,
        matchDate: m.matchDate,
        homeTeamId: m.homeTeamId,
        homeTeamName: teamMap.get(m.homeTeamId)?.name ?? String(m.homeTeamId),
        homeTeamLogo: teamMap.get(m.homeTeamId)?.logoUrl ?? null,
        awayTeamId: m.awayTeamId,
        awayTeamName: teamMap.get(m.awayTeamId)?.name ?? String(m.awayTeamId),
        awayTeamLogo: teamMap.get(m.awayTeamId)?.logoUrl ?? null,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        status: m.status,
        detailsSynced: m.detailsSynced === 1,
      });

      return {
        id: t.id,
        name: t.name,
        season: t.season,
        tournamentType: t.tournamentType,
        standings: standings,
        lastRound: lastRound !== null ? { round: lastRound, matches: lastRoundMatches.map(formatMatch) } : null,
        nextRound: nextRound !== null ? { round: nextRound, matches: nextRoundMatches.map(formatMatch) } : null,
      };
    }),
  );

  // ── Latest press notes ─────────────────────────────────────────────────────
  const pressNotesRepo = createPressNotesRepository(db);
  const latestNotes = await pressNotesRepo.listLatest(5);
  const pressNotes = latestNotes.map((n) => ({
    id: n.id,
    htTeamId: n.htTeamId,
    teamName: n.teamName,
    teamLogo: n.teamLogo,
    authorName: n.authorName,
    title: n.title,
    createdAt: n.createdAt,
  }));

  return c.json({ announcements, tournaments: tournamentSections, pressNotes });
});

export { app as homeApi };
