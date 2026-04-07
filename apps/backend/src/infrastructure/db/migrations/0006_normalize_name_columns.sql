-- Migration 0006: Normalize _name columns out of all tables
-- Team and player names are now resolved via JOINs with teams/players tables.
-- SQLite 3.35+ supports ALTER TABLE ... DROP COLUMN.

-- tournament_standings: remove team_name (resolved via JOIN with teams.ht_team_id)
ALTER TABLE tournament_standings DROP COLUMN team_name;

-- tournament_matches: remove home_team_name and away_team_name (resolved via JOIN)
ALTER TABLE tournament_matches DROP COLUMN home_team_name;
ALTER TABLE tournament_matches DROP COLUMN away_team_name;

-- match_events: remove subject_player_name and object_player_name (resolved via JOIN)
ALTER TABLE match_events DROP COLUMN subject_player_name;
ALTER TABLE match_events DROP COLUMN object_player_name;

-- match_appearances: remove player_name (resolved via JOIN with players.ht_player_id)
ALTER TABLE match_appearances DROP COLUMN player_name;

-- player_team_history: remove team_name (resolved via JOIN with teams.ht_team_id)
ALTER TABLE player_team_history DROP COLUMN team_name;
