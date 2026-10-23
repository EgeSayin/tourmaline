ALTER TABLE "settings" ADD COLUMN "hidden_category_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "uncategorized_hidden" boolean DEFAULT false NOT NULL;