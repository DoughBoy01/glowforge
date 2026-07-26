CREATE TABLE `skin_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'youcam' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_file_id` text,
	`provider_task_id` text,
	`skin_age` integer,
	`provider_overall_score` integer,
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
CREATE UNIQUE INDEX `skin_analyses_scan_unique_idx` ON `skin_analyses` (`scan_id`);--> statement-breakpoint
CREATE INDEX `skin_analyses_user_status_idx` ON `skin_analyses` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `skin_concern_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`concern` text NOT NULL,
	`raw_score` integer NOT NULL,
	`ui_score` integer NOT NULL,
	`mask_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`analysis_id`) REFERENCES `skin_analyses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skin_concern_scores_user_concern_idx` ON `skin_concern_scores` (`user_id`,`concern`,`created_at`);--> statement-breakpoint
CREATE INDEX `skin_concern_scores_analysis_idx` ON `skin_concern_scores` (`analysis_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `skin_concern_scores_scan_concern_unique_idx` ON `skin_concern_scores` (`scan_id`,`concern`);--> statement-breakpoint
CREATE UNIQUE INDEX `metric_scores_scan_metric_unique_idx` ON `metric_scores` (`scan_id`,`metric_type`);