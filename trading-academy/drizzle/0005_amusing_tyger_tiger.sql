CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`process_token` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`cash_delta_cents` integer NOT NULL,
	`cost_delta_cents` integer NOT NULL,
	`realized_delta_cents` integer NOT NULL,
	`quote_timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_account_idx` ON `orders` (`account_id`);--> statement-breakpoint
CREATE TABLE `positions` (
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`cost_cents` integer NOT NULL,
	`realized_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_account_symbol_idx` ON `positions` (`account_id`,`symbol`);--> statement-breakpoint
CREATE TABLE `previews` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `version` integer DEFAULT 0 NOT NULL;