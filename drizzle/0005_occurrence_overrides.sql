CREATE TABLE "occurrence_overrides" (
	"item_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	CONSTRAINT "occurrence_overrides_item_id_occurrence_date_pk" PRIMARY KEY("item_id","occurrence_date")
);
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_skipped_dates";--> statement-breakpoint
ALTER TABLE "occurrence_overrides" ADD CONSTRAINT "occurrence_overrides_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "skipped_dates";