CREATE TABLE `face_gym_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`completed_date` text NOT NULL,
	`rounds_completed` integer NOT NULL,
	`rounds_total` integer NOT NULL,
	`active_seconds` integer NOT NULL,
	`completed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `face_gym_sessions_user_date_idx` ON `face_gym_sessions` (`user_id`,`completed_date`);--> statement-breakpoint
CREATE INDEX `face_gym_sessions_user_completed_idx` ON `face_gym_sessions` (`user_id`,`completed_at`);