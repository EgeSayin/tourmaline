import "server-only";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import postgres from "postgres";
import { createDatabase } from "./connection";

// `next build` loads every route without a database, and nothing queries it then: every page is dynamic.
const building = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
const url = process.env.DATABASE_URL ?? (building ? "postgres://unused-at-build" : undefined);
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one connection pool across hot reloads in development instead of opening a new one per reload.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const client = globalForDb.pgClient ?? postgres(url);
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = createDatabase(client);
