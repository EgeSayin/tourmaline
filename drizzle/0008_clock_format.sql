CREATE TYPE "public"."clock_format" AS ENUM('24h', '12h');--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "clock_format" "clock_format";