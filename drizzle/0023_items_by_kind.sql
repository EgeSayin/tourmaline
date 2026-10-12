CREATE TABLE "fixed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"recurrence" jsonb,
	"occurrences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location" text,
	"buffer_before_min" integer NOT NULL,
	"buffer_after_min" integer NOT NULL,
	CONSTRAINT "fixed_items_times" CHECK ("fixed_items"."start_at" < "fixed_items"."end_at"),
	CONSTRAINT "fixed_items_buffers" CHECK ("fixed_items"."buffer_before_min" >= 0 and "fixed_items"."buffer_after_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"recurrence" jsonb,
	"occurrences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_min" integer NOT NULL,
	"earliest_start" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"split_min_chunk_min" integer,
	"split_max_chunk_min" integer,
	"spread" "spread" NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tasks_window" CHECK ("tasks"."earliest_start" < "tasks"."deadline"),
	CONSTRAINT "tasks_duration" CHECK ("tasks"."duration_min" > 0 and "tasks"."duration_min" % 5 = 0),
	CONSTRAINT "tasks_split" CHECK (("tasks"."split_min_chunk_min" is null) = ("tasks"."split_max_chunk_min" is null) and ("tasks"."split_min_chunk_min" is null or ("tasks"."split_min_chunk_min" between 1 and "tasks"."split_max_chunk_min" and "tasks"."split_min_chunk_min" % 5 = 0 and "tasks"."split_max_chunk_min" % 5 = 0)))
);
--> statement-breakpoint
-- An occurrence both skipped and done counts as skipped.
CREATE TEMPORARY TABLE "item_occurrences" ON COMMIT DROP AS
	SELECT "item_id", jsonb_object_agg("occurrence_date"::text, CASE WHEN "skipped" THEN 'skipped' ELSE 'done' END) AS "occurrences"
	FROM "occurrence_overrides" WHERE "skipped" OR "done" GROUP BY "item_id";
--> statement-breakpoint
INSERT INTO "fixed_items" ("id", "workspace_id", "title", "priority", "recurrence", "occurrences", "category_id", "created_at", "updated_at", "start_at", "end_at", "location", "buffer_before_min", "buffer_after_min")
	SELECT i."id", i."workspace_id", i."title", i."priority", i."recurrence", COALESCE(o."occurrences", '{}'::jsonb), i."category_id", i."created_at", i."updated_at", i."start_at", i."end_at", i."location", i."buffer_before_min", i."buffer_after_min"
	FROM "items" i LEFT JOIN "item_occurrences" o ON o."item_id" = i."id" WHERE i."timing" = 'fixed';
--> statement-breakpoint
INSERT INTO "tasks" ("id", "workspace_id", "title", "priority", "recurrence", "occurrences", "category_id", "created_at", "updated_at", "duration_min", "earliest_start", "deadline", "split_min_chunk_min", "split_max_chunk_min", "spread", "done")
	SELECT i."id", i."workspace_id", i."title", i."priority", i."recurrence", COALESCE(o."occurrences", '{}'::jsonb), i."category_id", i."created_at", i."updated_at", i."duration_min", i."earliest_start", i."deadline", i."split_min_chunk_min", i."split_max_chunk_min", i."spread", i."done"
	FROM "items" i LEFT JOIN "item_occurrences" o ON o."item_id" = i."id" WHERE i."timing" = 'flexible';
--> statement-breakpoint
ALTER TABLE "placements" DROP CONSTRAINT "placements_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "placements" DROP COLUMN "created_at";
--> statement-breakpoint
DROP TABLE "occurrence_overrides";
--> statement-breakpoint
DROP TABLE "items";
--> statement-breakpoint
DROP TYPE "public"."timing";
--> statement-breakpoint
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_item_id_tasks_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "fixed_items_workspace" ON "fixed_items" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "tasks_workspace" ON "tasks" USING btree ("workspace_id");
