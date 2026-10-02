CREATE TYPE "public"."placement_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"timing" "timing" DEFAULT 'flexible' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"source" "placement_source" DEFAULT 'auto' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placements_timing" CHECK ("placements"."timing" = 'flexible'),
	CONSTRAINT "placements_times" CHECK ("placements"."start_at" < "placements"."end_at")
);
--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_item_id_timing_items_id_timing_fk" FOREIGN KEY ("item_id","timing") REFERENCES "public"."items"("id","timing") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "placements_start_at" ON "placements" USING btree ("start_at");