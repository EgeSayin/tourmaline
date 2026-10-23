ALTER TABLE "categories" ALTER COLUMN "color" SET DATA TYPE text USING (CASE "color"
  WHEN 'slate' THEN '#64748b'
  WHEN 'red' THEN '#ef4444'
  WHEN 'orange' THEN '#f97316'
  WHEN 'yellow' THEN '#facc15'
  WHEN 'green' THEN '#22c55e'
  WHEN 'teal' THEN '#14b8a6'
  WHEN 'blue' THEN '#3b82f6'
  WHEN 'indigo' THEN '#6366f1'
  WHEN 'purple' THEN '#a855f7'
  WHEN 'pink' THEN '#ec4899'
END);--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_color" CHECK ("categories"."color" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
DROP TYPE "public"."category_color";
