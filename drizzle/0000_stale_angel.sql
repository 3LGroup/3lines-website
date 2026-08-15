CREATE TABLE `block_kinds` (
	`kind` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`family` text NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`min_items` integer,
	`max_items` integer,
	`recommended_items` integer,
	`label` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `block_translations` (
	`block_id` text NOT NULL,
	`locale` text NOT NULL,
	`props` text NOT NULL,
	`translation_state` text DEFAULT 'translated' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`block_id`, `locale`),
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text,
	`global_key` text,
	`parent_id` text,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`anchor` text,
	`stable_key` text,
	`props` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kind`) REFERENCES `block_kinds`(`kind`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `blocks_page_idx` ON `blocks` (`page_id`,`position`);--> statement-breakpoint
CREATE INDEX `blocks_parent_idx` ON `blocks` (`parent_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_page_stable_key` ON `blocks` (`page_id`,`stable_key`);--> statement-breakpoint
CREATE TABLE `locales` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`native_name` text NOT NULL,
	`dir` text DEFAULT 'ltr' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`fallback_code` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `migration_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`phase` text NOT NULL,
	`status` text NOT NULL,
	`source_git_sha` text,
	`content_checksum` text,
	`stats` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `page_translations` (
	`page_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`keywords` text,
	`translation_state` text DEFAULT 'translated' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`page_id`, `locale`),
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_refs` text,
	`position` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_route_unique` ON `pages` (`route`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_status_idx` ON `pages` (`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`editorial_note` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings_translations` (
	`key` text NOT NULL,
	`locale` text NOT NULL,
	`value` text,
	PRIMARY KEY(`key`, `locale`),
	FOREIGN KEY (`key`) REFERENCES `settings`(`key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ui_strings` (
	`key` text NOT NULL,
	`locale` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`key`, `locale`),
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action
);
