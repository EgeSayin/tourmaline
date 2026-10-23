import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/** For the container's health check: up, and reaching the database. */
export async function GET() {
  await db.execute(sql`select 1`);
  return new Response("ok");
}
