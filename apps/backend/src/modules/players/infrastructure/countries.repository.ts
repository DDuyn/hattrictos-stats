import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../../infrastructure/db/client';
import { countriesTable, type CountryRow } from './countries.table';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertCountryInput {
  countryId: number;
  leagueId: number | null;
  countryCode: string;
  name: string;
}

export interface CountriesRepository {
  /** Insert or update a country by its Hattrick countryId. */
  upsertCountry(input: UpsertCountryInput): Promise<CountryRow>;

  /** Find a country by its Hattrick CountryID. */
  findByCountryId(countryId: number): Promise<CountryRow | null>;

  /** List all countries. */
  listAll(): Promise<CountryRow[]>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCountriesRepository(db: DB): CountriesRepository {
  return {
    async upsertCountry(input) {
      await db
        .insert(countriesTable)
        .values({
          id: randomUUID(),
          countryId: input.countryId,
          leagueId: input.leagueId,
          countryCode: input.countryCode,
          name: input.name,
        })
        .onConflictDoUpdate({
          target: countriesTable.countryId,
          set: {
            leagueId: input.leagueId,
            countryCode: input.countryCode,
            name: input.name,
          },
        });

      return (await db
        .select()
        .from(countriesTable)
        .where(eq(countriesTable.countryId, input.countryId))
        .get()) as CountryRow;
    },

    async findByCountryId(countryId) {
      return (
        (await db
          .select()
          .from(countriesTable)
          .where(eq(countriesTable.countryId, countryId))
          .get()) ?? null
      );
    },

    async listAll() {
      return db.select().from(countriesTable).all();
    },
  };
}
