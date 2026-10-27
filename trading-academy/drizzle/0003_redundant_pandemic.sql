CREATE TABLE `watchlist` (
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `watchlist_account_idx` ON `watchlist` (`account_id`);