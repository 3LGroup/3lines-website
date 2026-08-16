CREATE TABLE `news_item_translations` (
	`item_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`tag` text NOT NULL,
	`type` text NOT NULL,
	`media_alt` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`item_id`, `locale`),
	FOREIGN KEY (`item_id`) REFERENCES `news_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`route` text NOT NULL,
	`date` text NOT NULL,
	`media_src` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_items_slug_unique` ON `news_items` (`slug`);--> statement-breakpoint
CREATE INDEX `news_items_date_idx` ON `news_items` (`date`);