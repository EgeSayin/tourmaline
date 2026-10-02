CREATE TYPE "public"."priority" AS ENUM('mandatory', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."spread" AS ENUM('asap', 'even', 'just-in-time');--> statement-breakpoint
CREATE TYPE "public"."timing" AS ENUM('fixed', 'flexible');--> statement-breakpoint
CREATE TABLE "fixed_item_details" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"timing" "timing" DEFAULT 'fixed' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location" text,
	"buffer_before_min" integer DEFAULT 0 NOT NULL,
	"buffer_after_min" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fixed_item_details_timing" CHECK ("fixed_item_details"."timing" = 'fixed'),
	CONSTRAINT "fixed_item_details_times" CHECK ("fixed_item_details"."start_at" < "fixed_item_details"."end_at"),
	CONSTRAINT "fixed_item_details_buffers" CHECK ("fixed_item_details"."buffer_before_min" >= 0 and "fixed_item_details"."buffer_after_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "flexible_item_details" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"timing" "timing" DEFAULT 'flexible' NOT NULL,
	"duration_min" integer NOT NULL,
	"earliest_start" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"split_min_chunk_min" integer,
	"split_max_chunk_min" integer,
	"preferred_windows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"spread" "spread" DEFAULT 'even' NOT NULL,
	CONSTRAINT "flexible_item_details_timing" CHECK ("flexible_item_details"."timing" = 'flexible'),
	CONSTRAINT "flexible_item_details_duration" CHECK ("flexible_item_details"."duration_min" > 0),
	CONSTRAINT "flexible_item_details_window" CHECK ("flexible_item_details"."earliest_start" < "flexible_item_details"."deadline"),
	CONSTRAINT "flexible_item_details_split" CHECK (("flexible_item_details"."split_min_chunk_min" is null) = ("flexible_item_details"."split_max_chunk_min" is null) and ("flexible_item_details"."split_min_chunk_min" is null or "flexible_item_details"."split_min_chunk_min" between 1 and "flexible_item_details"."split_max_chunk_min"))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"timing" "timing" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_id_timing" UNIQUE("id","timing")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"time_zone" text NOT NULL,
	"downtime_start_minute" integer NOT NULL,
	"downtime_end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_downtime_minutes" CHECK ("settings"."downtime_start_minute" between 0 and 1439 and "settings"."downtime_end_minute" between 0 and 1439)
);
--> statement-breakpoint
ALTER TABLE "fixed_item_details" ADD CONSTRAINT "fixed_item_details_item_id_timing_items_id_timing_fk" FOREIGN KEY ("item_id","timing") REFERENCES "public"."items"("id","timing") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexible_item_details" ADD CONSTRAINT "flexible_item_details_item_id_timing_items_id_timing_fk" FOREIGN KEY ("item_id","timing") REFERENCES "public"."items"("id","timing") ON DELETE cascade ON UPDATE no action;