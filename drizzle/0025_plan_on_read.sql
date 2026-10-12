DROP TABLE "plans" CASCADE;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "planned_at" timestamp with time zone;