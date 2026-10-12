ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "fixed_items" DROP CONSTRAINT "fixed_items_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_category_id_categories_id_fk";
--> statement-breakpoint
-- Sets only category_id null: the item stays in its workspace (Drizzle can't express the column list).
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE SET NULL ("category_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE SET NULL ("category_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_items" ADD CONSTRAINT "fixed_items_interval" CHECK (("fixed_items"."recurrence"->>'interval')::integer >= 1);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_interval" CHECK (("tasks"."recurrence"->>'interval')::integer >= 1);
