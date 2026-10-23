CREATE TABLE `sb_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_events` (
	`id` text PRIMARY KEY NOT NULL,
	`sport` text NOT NULL,
	`matchup` text NOT NULL,
	`starts_at` integer NOT NULL,
	`state` text NOT NULL,
	`source` text NOT NULL,
	`source_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_guards` (
	`nonce` text PRIMARY KEY NOT NULL,
	`session_digest` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_invites` (
	`digest` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`starting_balance` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`event_id` text NOT NULL,
	`event_name` text NOT NULL,
	`selection` text NOT NULL,
	`odds` integer NOT NULL,
	`stake` integer NOT NULL,
	`potential_return` integer NOT NULL,
	`request_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`snapshot` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_postings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tx` text NOT NULL,
	`account` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`market` text NOT NULL,
	`selection` text NOT NULL,
	`odds` integer NOT NULL,
	`line` text,
	`side` text NOT NULL,
	`subject` text,
	`period` text NOT NULL,
	`source` text NOT NULL,
	`source_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`closes_at` integer NOT NULL,
	`live` integer DEFAULT 0 NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL,
	`licensed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_rates` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`hits` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_recovery` (
	`digest` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_sessions` (
	`digest` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`csrf` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pick_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`payout` integer NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sb_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`initial_balance` integer DEFAULT 100000 NOT NULL,
	`invite_digest` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sb_users_username_unique` ON `sb_users` (`username`);