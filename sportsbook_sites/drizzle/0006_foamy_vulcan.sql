CREATE TABLE `sb_line_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series` text NOT NULL,
	`event_id` text NOT NULL,
	`market` text NOT NULL,
	`side` text NOT NULL,
	`period` text NOT NULL,
	`subject` text,
	`source` text NOT NULL,
	`live` integer NOT NULL,
	`selection` text NOT NULL,
	`line` text,
	`odds` integer NOT NULL,
	`observed_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`source_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sb_movement_observation` ON `sb_line_movements` (`series`,`observed_at`);--> statement-breakpoint
CREATE INDEX `sb_movement_event` ON `sb_line_movements` (`event_id`,`market`,`observed_at`);