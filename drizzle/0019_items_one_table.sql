ALTER TABLE "items" ADD COLUMN "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "buffer_before_min" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "buffer_after_min" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "duration_min" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "earliest_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "split_min_chunk_min" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "split_max_chunk_min" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "spread" "spread";--> statement-breakpoint
UPDATE "items" SET "start_at" = d."start_at", "end_at" = d."end_at", "location" = d."location", "buffer_before_min" = d."buffer_before_min", "buffer_after_min" = d."buffer_after_min" FROM "fixed_item_details" d WHERE d."item_id" = "items"."id";--> statement-breakpoint
UPDATE "items" SET "duration_min" = d."duration_min", "earliest_start" = d."earliest_start", "deadline" = d."deadline", "split_min_chunk_min" = d."split_min_chunk_min", "split_max_chunk_min" = d."split_max_chunk_min", "spread" = d."spread" FROM "flexible_item_details" d WHERE d."item_id" = "items"."id";--> statement-breakpoint
ALTER TABLE "placements" DROP CONSTRAINT "placements_item_id_timing_items_id_timing_fk";--> statement-breakpoint
ALTER TABLE "placements" DROP CONSTRAINT "placements_timing";--> statement-breakpoint
ALTER TABLE "placements" DROP COLUMN "timing";--> statement-breakpoint
DROP TABLE "fixed_item_details" CASCADE;--> statement-breakpoint
DROP TABLE "flexible_item_details" CASCADE;--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_id_timing";--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_kind" CHECK (case "items"."timing"
        when 'fixed' then num_nonnulls("items"."start_at", "items"."end_at", "items"."buffer_before_min", "items"."buffer_after_min") = 4
          and num_nonnulls("items"."duration_min", "items"."earliest_start", "items"."deadline", "items"."split_min_chunk_min", "items"."split_max_chunk_min", "items"."spread") = 0
          and "items"."start_at" < "items"."end_at" and "items"."buffer_before_min" >= 0 and "items"."buffer_after_min" >= 0
        else num_nonnulls("items"."duration_min", "items"."earliest_start", "items"."deadline", "items"."spread") = 4
          and num_nonnulls("items"."start_at", "items"."end_at", "items"."location", "items"."buffer_before_min", "items"."buffer_after_min") = 0
          and "items"."earliest_start" < "items"."deadline" and "items"."duration_min" > 0 and "items"."duration_min" % 5 = 0
      end);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_split" CHECK (("items"."split_min_chunk_min" is null) = ("items"."split_max_chunk_min" is null) and ("items"."split_min_chunk_min" is null or ("items"."split_min_chunk_min" between 1 and "items"."split_max_chunk_min" and "items"."split_min_chunk_min" % 5 = 0 and "items"."split_max_chunk_min" % 5 = 0)));
