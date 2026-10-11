ALTER TABLE "settings" DROP CONSTRAINT "settings_downtime_minutes";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "downtime" jsonb DEFAULT '[[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}],[{"startMinute":0,"endMinute":600},{"startMinute":1380,"endMinute":1440}]]'::jsonb NOT NULL;--> statement-breakpoint
-- Each day gets the old window, split at midnight when it ran overnight.
UPDATE "settings" SET "downtime" = (
  SELECT jsonb_agg("day")
  FROM generate_series(1, 7),
  LATERAL (
    SELECT coalesce(jsonb_agg(jsonb_build_object('startMinute', "start", 'endMinute', "end") ORDER BY "start"), '[]') AS "day"
    FROM (VALUES
      (CASE WHEN "downtime_start_minute" > "downtime_end_minute" THEN 0 ELSE "downtime_start_minute" END, "downtime_end_minute"),
      ("downtime_start_minute", CASE WHEN "downtime_start_minute" > "downtime_end_minute" THEN 1440 ELSE "downtime_start_minute" END)
    ) AS "range"("start", "end")
    WHERE "start" < "end"
  )
);--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "downtime_start_minute";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "downtime_end_minute";--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_downtime_week" CHECK (jsonb_array_length("settings"."downtime") = 7);