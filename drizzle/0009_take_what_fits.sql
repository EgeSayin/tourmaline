ALTER TABLE "tasks" ADD COLUMN "up_to" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "total_min" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_up_to" CHECK (not "tasks"."up_to" or "tasks"."within_period");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_total" CHECK ("tasks"."total_min" is null or ("tasks"."recurrence" is not null and "tasks"."total_min" > 0 and "tasks"."total_min" % 5 = 0));