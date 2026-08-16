CREATE TABLE `skin_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'youcam' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`predicted_skin_age` integer,
	`predicted_overall_score` integer,
	`provider_file_id` text,
	`provider_task_id` text,
	`raw_result` text,
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
CREATE UNIQUE INDEX `skin_predictions_scan_unique_idx` ON `skin_predictions` (`scan_id`);--> statement-breakpoint
CREATE INDEX `skin_predictions_user_status_idx` ON `skin_predictions` (`user_id`,`status`);