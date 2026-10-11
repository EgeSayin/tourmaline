CREATE TYPE "public"."placement_status" AS ENUM('planned', 'done', 'missed');--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "status" "placement_status" DEFAULT 'planned' NOT NULL;--> statement-breakpoint
UPDATE "placements" SET "status" = 'done' WHERE "done";
