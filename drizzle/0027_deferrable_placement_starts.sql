-- Checked once each statement ends instead of row by row, so one UPDATE can shift every placement (e.g. to another
-- time zone) without two briefly sharing a start. Drizzle can't declare this, so schema.ts only notes it.
ALTER TABLE "placements" DROP CONSTRAINT "placements_task_start";--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_task_start" UNIQUE NULLS NOT DISTINCT ("item_id", "occurrence_date", "start_at") DEFERRABLE INITIALLY IMMEDIATE;
