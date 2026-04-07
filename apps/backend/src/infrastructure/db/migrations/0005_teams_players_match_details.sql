-- Migration 0005: teams, players, match_events, match_appearances
-- Adds teams, tournament_team_seasons, players, player_team_history tables
-- Adds match_events and match_appearances tables
-- Adds details_synced column to tournament_matches

-- teams: normalized team registry
CREATE TABLE `teams` (
  `id` text PRIMARY KEY NOT NULL,
  `ht_team_id` integer NOT NULL UNIQUE,
  `name` text NOT NULL,
  `short_name` text NOT NULL DEFAULT ''
);

-- tournament_team_seasons: which teams participated in each tournament
CREATE TABLE `tournament_team_seasons` (
  `id` text PRIMARY KEY NOT NULL,
  `tournament_id` text NOT NULL REFERENCES `tournaments`(`id`) ON DELETE CASCADE,
  `team_id` text NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `ht_team_id` integer NOT NULL
);

-- players: player registry persisted across seasons
CREATE TABLE `players` (
  `id` text PRIMARY KEY NOT NULL,
  `ht_player_id` integer NOT NULL UNIQUE,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `current_ht_team_id` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

-- player_team_history: tracks which team each player belonged to over time
CREATE TABLE `player_team_history` (
  `id` text PRIMARY KEY NOT NULL,
  `ht_player_id` integer NOT NULL,
  `ht_team_id` integer NOT NULL,
  `team_name` text NOT NULL,
  `first_seen_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL
);

-- match_events: goals and relevant events per match (EventTypeID 100-199 = goals)
CREATE TABLE `match_events` (
  `id` text PRIMARY KEY NOT NULL,
  `match_id` text NOT NULL REFERENCES `tournament_matches`(`id`) ON DELETE CASCADE,
  `tournament_id` text NOT NULL REFERENCES `tournaments`(`id`) ON DELETE CASCADE,
  `event_type_id` integer NOT NULL,
  `minute` integer NOT NULL,
  `subject_player_id` integer,
  `subject_player_name` text,
  `subject_team_id` integer,
  `object_player_id` integer,
  `object_player_name` text
);

-- match_appearances: player appearances per match (starters + substitutes)
CREATE TABLE `match_appearances` (
  `id` text PRIMARY KEY NOT NULL,
  `match_id` text NOT NULL REFERENCES `tournament_matches`(`id`) ON DELETE CASCADE,
  `tournament_id` text NOT NULL REFERENCES `tournaments`(`id`) ON DELETE CASCADE,
  `ht_player_id` integer NOT NULL,
  `player_name` text NOT NULL,
  `ht_team_id` integer NOT NULL,
  `role_id` integer NOT NULL,
  `behaviour` integer NOT NULL DEFAULT 0,
  `minute_in` integer NOT NULL DEFAULT 0,
  `minute_out` integer,
  `rating_stars` real
);

-- Add details_synced flag to tournament_matches
ALTER TABLE `tournament_matches` ADD COLUMN `details_synced` integer NOT NULL DEFAULT 0;
