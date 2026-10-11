CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The personal workspace (PERSONAL_WORKSPACE_ID) takes every existing row.
INSERT INTO "workspaces" ("id") VALUES ('00000000-0000-4000-8000-000000000000');--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_name_unique";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_single_row";--> statement-breakpoint
DROP INDEX "placements_start_at";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000' PRIMARY KEY;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "placements" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_workspace" ON "items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "placements_workspace_start_at" ON "placements" USING btree ("workspace_id","start_at");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_name" UNIQUE("workspace_id","name");
