CREATE TABLE `equity_history` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`cash_cents` integer NOT NULL,
	`market_value_cents` integer NOT NULL,
	`equity_cents` integer NOT NULL,
	`source_as_of` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equity_history_account_time_idx` ON `equity_history` (`account_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `limit_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`limit_cents` integer NOT NULL,
	`reserved_cents` integer NOT NULL,
	`time_in_force` text NOT NULL,
	`trading_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`process_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`checked_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `limit_orders_account_status_idx` ON `limit_orders` (`account_id`,`status`);--> statement-breakpoint
ALTER TABLE `previews` ADD `order_type` text DEFAULT 'market' NOT NULL;--> statement-breakpoint
ALTER TABLE `previews` ADD `limit_cents` integer;--> statement-breakpoint
ALTER TABLE `previews` ADD `time_in_force` text DEFAULT 'GTC' NOT NULL;