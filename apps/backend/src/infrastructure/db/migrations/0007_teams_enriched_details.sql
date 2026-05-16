-- Migration 0007: Add enriched team details columns
-- These columns are populated during tournament sync via the CHPP teamdetails endpoint.

ALTER TABLE teams ADD COLUMN manager_login_name TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN league_name TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN arena_name TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN founded_date TEXT NOT NULL DEFAULT '';
