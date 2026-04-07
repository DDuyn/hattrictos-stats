CREATE TABLE `tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`ht_match_id` integer NOT NULL,
	`round` integer NOT NULL,
	`match_date` text NOT NULL,
	`home_team_id` integer NOT NULL,
	`home_team_name` text NOT NULL,
	`away_team_id` integer NOT NULL,
	`away_team_name` text NOT NULL,
	`home_goals` integer,
	`away_goals` integer,
	`status` text DEFAULT 'Upcoming' NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_standings` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`group_id` integer NOT NULL,
	`ht_team_id` integer NOT NULL,
	`team_name` text NOT NULL,
	`position` integer NOT NULL,
	`played` integer DEFAULT 0 NOT NULL,
	`won` integer DEFAULT 0 NOT NULL,
	`drawn` integer DEFAULT 0 NOT NULL,
	`lost` integer DEFAULT 0 NOT NULL,
	`goals_for` integer DEFAULT 0 NOT NULL,
	`goals_against` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`ht_tournament_id` integer NOT NULL,
	`name` text NOT NULL,
	`season` integer,
	`tournament_type` integer,
	`number_of_teams` integer,
	`last_synced_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournaments_ht_tournament_id_unique` ON `tournaments` (`ht_tournament_id`);