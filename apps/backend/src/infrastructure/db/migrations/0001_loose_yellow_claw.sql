CREATE TABLE `chpp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`access_token_secret_encrypted` text NOT NULL,
	`ht_user_id` text,
	`ht_login_name` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
