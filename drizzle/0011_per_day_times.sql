ALTER TABLE "fixed_items" ADD COLUMN "day_times" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "day_durations" jsonb;--> statement-breakpoint
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_day_times" CHECK ("fixed_items"."day_times" is null or "fixed_items"."recurrence"->>'frequency' is not distinct from 'weekly');--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_day_durations" CHECK ("tasks"."day_durations" is null or "tasks"."recurrence"->>'frequency' is not distinct from 'weekly');