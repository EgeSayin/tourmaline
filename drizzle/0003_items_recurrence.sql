ALTER TABLE "items" ADD COLUMN "recurrence" jsonb;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "skipped_dates" date[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_skipped_dates" CHECK ("items"."recurrence" is not null or cardinality("items"."skipped_dates") = 0);