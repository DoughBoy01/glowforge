CREATE TABLE `skin_simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'youcam' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`goal_focus` text DEFAULT 'overall' NOT NULL,
	`goal_horizon_weeks` integer DEFAULT 12 NOT NULL,
	`params` text,
	`provider_file_id` text,
	`provider_task_id` text,
	`r2_key` text,
	`error_code` text,
	`error_message` text,
	`requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skin_simulations_scan_unique_idx` ON `skin_simulations` (`scan_id`);--> statement-breakpoint
CREATE INDEX `skin_simulations_user_status_idx` ON `skin_simulations` (`user_id`,`status`);