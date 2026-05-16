-- Migration 0009: Add logo_url column to teams table
-- Stores the relative path to the team's logo image (e.g. /logos/12345.png)
-- Null means no logo has been uploaded yet.

ALTER TABLE teams ADD COLUMN logo_url TEXT;
