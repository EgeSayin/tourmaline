-- The whole schema as of 2026-10-12, squashing migrations 0000–0027. Hand-written, as Drizzle can't declare them:
-- the role workspace transactions take and its grants, the item category key nulling only "category_id", the
-- deferrable unique placement start, and the personal workspace with its settings.
-- Roles are cluster-wide, so another database's migration may have created it already. It has no login: the owner
-- takes it for each workspace transaction (SET LOCAL ROLE), which needs membership unless the owner is a superuser.
DO $$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'workspace_user') THEN
		CREATE ROLE "workspace_user" NOLOGIN NOBYPASSRLS;
	END IF;
END
$$;--> statement-breakpoint
GRANT "workspace_user" TO CURRENT_USER;--> statement-breakpoint
CREATE TYPE "public"."category_color" AS ENUM('slate', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink');--> statement-breakpoint
CREATE TYPE "public"."placement_status" AS ENUM('planned', 'done', 'missed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('mandatory', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."spread" AS ENUM('asap', 'even', 'just-in-time');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" "category_color" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_workspace_name" UNIQUE("workspace_id","name"),
	CONSTRAINT "categories_workspace_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	CONSTRAINT "fixed_items_interval" CHECK (("fixed_items"."recurrence"->>'interval')::integer >= 1),
	CONSTRAINT "fixed_items_times" CHECK ("fixed_items"."start_at" < "fixed_items"."end_at"),
	CONSTRAINT "fixed_items_buffers" CHECK ("fixed_items"."buffer_before_min" >= 0 and "fixed_items"."buffer_after_min" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fixed_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"occurrence_date" date,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"status" "placement_status" DEFAULT 'planned' NOT NULL,
	CONSTRAINT "placements_task_start" UNIQUE NULLS NOT DISTINCT("item_id","occurrence_date","start_at") DEFERRABLE INITIALLY IMMEDIATE,
	CONSTRAINT "placements_times" CHECK ("placements"."start_at" < "placements"."end_at")
);
--> statement-breakpoint
ALTER TABLE "placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"downtime" jsonb DEFAULT '[[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}]]'::jsonb NOT NULL,
	"focus_caps_min" jsonb DEFAULT '[null,null,null,null,null,null,null]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_focus_caps_week" CHECK (jsonb_array_length("settings"."focus_caps_min") = 7),
	CONSTRAINT "settings_downtime_week" CHECK (jsonb_array_length("settings"."downtime") = 7)
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	CONSTRAINT "tasks_interval" CHECK (("tasks"."recurrence"->>'interval')::integer >= 1),
	CONSTRAINT "tasks_window" CHECK ("tasks"."earliest_start" < "tasks"."deadline"),
	CONSTRAINT "tasks_duration" CHECK ("tasks"."duration_min" > 0 and "tasks"."duration_min" % 5 = 0),
	CONSTRAINT "tasks_split" CHECK (("tasks"."split_min_chunk_min" is null) = ("tasks"."split_max_chunk_min" is null) and ("tasks"."split_min_chunk_min" is null or ("tasks"."split_min_chunk_min" between 1 and "tasks"."split_max_chunk_min" and "tasks"."split_min_chunk_min" % 5 = 0 and "tasks"."split_max_chunk_min" % 5 = 0)))
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"planned_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE SET NULL ("category_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_item_id_tasks_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE SET NULL ("category_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_items_workspace" ON "fixed_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "placements_workspace_start_at" ON "placements" USING btree ("workspace_id","start_at");--> statement-breakpoint
CREATE INDEX "tasks_workspace" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE POLICY "own_rows" ON "categories" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("categories"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("categories"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "fixed_items" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("fixed_items"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("fixed_items"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "placements" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("placements"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("placements"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "settings" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("settings"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("settings"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "tasks" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("tasks"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("tasks"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "workspaces" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("workspaces"."id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("workspaces"."id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspaces", "settings", "categories", "fixed_items", "tasks", "placements" TO "workspace_user";--> statement-breakpoint
-- The personal workspace (PERSONAL_WORKSPACE_ID), used outside demo mode.
INSERT INTO "workspaces" ("id") VALUES ('00000000-0000-4000-8000-000000000000');--> statement-breakpoint
INSERT INTO "settings" ("workspace_id") VALUES ('00000000-0000-4000-8000-000000000000');
