-- Migration 0008: countries table + player enrichment + team players_synced_at

-- New table: countries (populated from CHPP worlddetails endpoint)
CREATE TABLE IF NOT EXISTS countries (
  id TEXT PRIMARY KEY NOT NULL,
  country_id INTEGER NOT NULL UNIQUE,
  league_id INTEGER,
  country_code TEXT NOT NULL,
  name TEXT NOT NULL
);

-- Enrich players with age and nationality
ALTER TABLE players ADD COLUMN age INTEGER;
ALTER TABLE players ADD COLUMN age_days INTEGER;
ALTER TABLE players ADD COLUMN country_id INTEGER;

-- Track when we last synced the player roster for a team (to avoid re-syncing too often)
ALTER TABLE teams ADD COLUMN players_synced_at INTEGER;
