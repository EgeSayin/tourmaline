import "server-only";
import postgres from "postgres";
import { createDatabase } from "./connection";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one connection pool across hot reloads in development instead of opening a new one per reload.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const client = globalForDb.pgClient ?? postgres(url);
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = createDatabase(client);
