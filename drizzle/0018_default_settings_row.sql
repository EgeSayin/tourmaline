ALTER TABLE "settings" ALTER COLUMN "time_zone" SET DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "downtime_start_minute" SET DEFAULT 1380;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "downtime_end_minute" SET DEFAULT 600;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "focus_caps_min" SET DEFAULT '[null,null,null,null,null,null,null]'::jsonb;--> statement-breakpoint
INSERT INTO "settings" DEFAULT VALUES ON CONFLICT DO NOTHING;