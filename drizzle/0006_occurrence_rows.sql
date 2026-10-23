CREATE TYPE "public"."occurrence_state" AS ENUM('skipped', 'done');--> statement-breakpoint
CREATE TABLE "fixed_item_occurrences" (
	"item_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"date" date NOT NULL,
	"state" "occurrence_state",
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	CONSTRAINT "fixed_item_occurrences_pk" PRIMARY KEY("item_id","date"),
	CONSTRAINT "fixed_item_occurrences_times" CHECK (("fixed_item_occurrences"."start_at" is null) = ("fixed_item_occurrences"."end_at" is null) and "fixed_item_occurrences"."start_at" < "fixed_item_occurrences"."end_at"),
	CONSTRAINT "fixed_item_occurrences_used" CHECK ("fixed_item_occurrences"."state" is not null or "fixed_item_occurrences"."start_at" is not null),
	CONSTRAINT "fixed_item_occurrences_state" CHECK ("fixed_item_occurrences"."state" is distinct from 'done')
);
--> statement-breakpoint
ALTER TABLE "fixed_item_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_occurrences" (
	"item_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"date" date NOT NULL,
	"state" "occurrence_state",
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"duration_min" integer,
	CONSTRAINT "task_occurrences_pk" PRIMARY KEY("item_id","date"),
	CONSTRAINT "task_occurrences_times" CHECK (("task_occurrences"."start_at" is null) = ("task_occurrences"."end_at" is null) and "task_occurrences"."start_at" < "task_occurrences"."end_at"),
	CONSTRAINT "task_occurrences_used" CHECK ("task_occurrences"."state" is not null or "task_occurrences"."start_at" is not null),
	CONSTRAINT "task_occurrences_duration" CHECK (("task_occurrences"."duration_min" is null) = ("task_occurrences"."start_at" is null) and "task_occurrences"."duration_min" > 0)
);
--> statement-breakpoint
ALTER TABLE "task_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fixed_item_occurrences" ADD CONSTRAINT "fixed_item_occurrences_item_id_fixed_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."fixed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_item_occurrences" ADD CONSTRAINT "fixed_item_occurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_item_id_tasks_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- The occurrence states move from each item's JSON map to a row each.
INSERT INTO "fixed_item_occurrences" ("item_id", "workspace_id", "date", "state")
	SELECT "id", "workspace_id", "key"::date, ("value" #>> '{}')::"occurrence_state"
	FROM "fixed_items", jsonb_each("occurrences") WHERE "value" #>> '{}' = 'skipped';--> statement-breakpoint
INSERT INTO "task_occurrences" ("item_id", "workspace_id", "date", "state")
	SELECT "id", "workspace_id", "key"::date, ("value" #>> '{}')::"occurrence_state"
	FROM "tasks", jsonb_each("occurrences");--> statement-breakpoint
ALTER TABLE "fixed_items" DROP COLUMN "occurrences";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "occurrences";--> statement-breakpoint
CREATE POLICY "own_rows" ON "fixed_item_occurrences" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("fixed_item_occurrences"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("fixed_item_occurrences"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "task_occurrences" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("task_occurrences"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("task_occurrences"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "fixed_item_occurrences", "task_occurrences" TO "workspace_user";
