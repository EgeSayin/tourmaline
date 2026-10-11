ALTER TABLE "items" ADD COLUMN "done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "occurrence_overrides" ADD COLUMN "done" boolean DEFAULT false NOT NULL;