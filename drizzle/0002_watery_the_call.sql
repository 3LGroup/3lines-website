CREATE TABLE `chrome_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`props` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chrome_translations` (
	`id` text NOT NULL,
	`locale` text NOT NULL,
	`props` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`id`, `locale`),
	FOREIGN KEY (`id`) REFERENCES `chrome_docs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action
);
