CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`tokens_prompt` integer DEFAULT 0,
	`tokens_completion` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
