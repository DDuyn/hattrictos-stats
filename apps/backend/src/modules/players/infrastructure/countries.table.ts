import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── countries ────────────────────────────────────────────────────────────────

export const countriesTable = sqliteTable('countries', {
  id: text('id').primaryKey(),
  /** Hattrick CountryID (different from LeagueID) */
  countryId: integer('country_id').notNull().unique(),
  /** Hattrick LeagueID for this country */
  leagueId: integer('league_id'),
  /** ISO 3166-1 alpha-2 code (e.g. "ES", "HR", "SE") */
  countryCode: text('country_code').notNull(),
  /** English name (e.g. "Spain", "Croatia") */
  name: text('name').notNull(),
});

export type CountryRow = typeof countriesTable.$inferSelect;
export type NewCountryRow = typeof countriesTable.$inferInsert;
