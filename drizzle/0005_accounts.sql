CREATE TABLE "instance" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"sign_up_open" boolean DEFAULT false NOT NULL,
	CONSTRAINT "instance_single_row" CHECK ("instance"."id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"workspace_id" uuid NOT NULL,
	"failed_sign_ins" integer DEFAULT 0 NOT NULL,
	"sign_in_paused_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "users_username" CHECK ("users"."username" ~ '^[a-z0-9._-]{3,32}$')
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- The instance's settings row.
INSERT INTO "instance" DEFAULT VALUES;--> statement-breakpoint
-- The personal workspace, from before accounts, with everything in it; each account starts its own.
DELETE FROM "workspaces" WHERE "id" = '00000000-0000-4000-8000-000000000000';
