CREATE TABLE "plans" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"planned_at" timestamp with time zone NOT NULL,
	"queue" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;