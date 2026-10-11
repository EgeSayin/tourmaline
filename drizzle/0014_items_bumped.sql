ALTER TABLE "items" ADD COLUMN "bumped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "occurrence_overrides" ADD COLUMN "bumped" boolean DEFAULT false NOT NULL;