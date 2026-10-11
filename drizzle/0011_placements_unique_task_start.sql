-- Concurrent re-plans could save the same placement twice; keep one, preferring a reviewed copy.
DELETE FROM "placements" AS "a" USING "placements" AS "b"
WHERE "a"."item_id" = "b"."item_id"
  AND "a"."occurrence_date" IS NOT DISTINCT FROM "b"."occurrence_date"
  AND "a"."start_at" = "b"."start_at"
  AND (("a"."status" = 'planned') > ("b"."status" = 'planned')
    OR (("a"."status" = 'planned') = ("b"."status" = 'planned') AND "a"."id" > "b"."id"));--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_task_start" UNIQUE NULLS NOT DISTINCT("item_id","occurrence_date","start_at");