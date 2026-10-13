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
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspaces", "settings", "categories", "fixed_items", "tasks", "placements" TO "workspace_user";--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fixed_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own_rows" ON "categories" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("categories"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("categories"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "fixed_items" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("fixed_items"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("fixed_items"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "placements" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("placements"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("placements"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "settings" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("settings"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("settings"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "tasks" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("tasks"."workspace_id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("tasks"."workspace_id" = current_setting('app.workspace_id')::uuid);--> statement-breakpoint
CREATE POLICY "own_rows" ON "workspaces" AS PERMISSIVE FOR ALL TO "workspace_user" USING ("workspaces"."id" = current_setting('app.workspace_id')::uuid) WITH CHECK ("workspaces"."id" = current_setting('app.workspace_id')::uuid);