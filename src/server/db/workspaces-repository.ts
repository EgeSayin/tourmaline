import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, lt, ne, notExists, notInArray } from "drizzle-orm";
import { addMinutes } from "@/lib/time/duration";
import type { Executor } from "./connection";
import { categories, fixedItems, sessions, settings, tasks, users, workspaces } from "./schema";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new, empty workspace with default settings. */
export async function createWorkspace(executor: Executor): Promise<string> {
  const [{ id }] = await executor.insert(workspaces).values({}).returning({ id: workspaces.id });
  await executor.insert(settings).values({ workspaceId: id });
  return id;
}

/** A new session in `workspaceId`, an account's if `userId` is given; returns the token its cookie holds. */
export async function createSession(executor: Executor, workspaceId: string, userId?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await executor.insert(sessions).values({ tokenHash: hash(token), workspaceId, userId });
  return token;
}

/** A new guest workspace, and the token of a session in it. */
export function createGuestWorkspace(executor: Executor): Promise<{ workspaceId: string; token: string }> {
  return executor.transaction(async (tx) => {
    const workspaceId = await createWorkspace(tx);
    return { workspaceId, token: await createSession(tx, workspaceId) };
  });
}

export interface OpenSession {
  workspaceId: string;
  /** `null` for a guest. */
  userId: string | null;
}

/**
 * The session `token` opens, its workspace marked as used `now` unless it was within the last `touchEveryMin`
 * minutes; `undefined` once it was deleted.
 */
export async function openSession(
  executor: Executor,
  token: string,
  now: Date,
  touchEveryMin: number,
): Promise<OpenSession | undefined> {
  const [session] = await executor
    .select({ workspaceId: sessions.workspaceId, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.tokenHash, hash(token)));
  if (!session) return undefined;
  await executor
    .update(workspaces)
    .set({ lastUsedAt: now })
    .where(and(eq(workspaces.id, session.workspaceId), lt(workspaces.lastUsedAt, addMinutes(now, -touchEveryMin))));
  return session;
}

export async function deleteSession(executor: Executor, token: string): Promise<void> {
  await executor.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
}

/** Signs the account out everywhere, except in the session `keepToken` opens if it's given. */
export async function deleteAccountSessions(executor: Executor, userId: string, keepToken?: string): Promise<void> {
  await executor
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), keepToken ? ne(sessions.tokenHash, hash(keepToken)) : undefined));
}

/** Deletes guest workspaces unused since `idleSince`, and all but the `keep` most recently used. */
export async function deleteIdleWorkspaces(executor: Executor, idleSince: Date, keep: number): Promise<void> {
  const guest = notExists(executor.select().from(users).where(eq(users.workspaceId, workspaces.id)));
  const recent = executor
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(guest)
    .orderBy(desc(workspaces.lastUsedAt))
    .limit(keep);
  await executor.delete(workspaces).where(and(guest, lt(workspaces.lastUsedAt, idleSince)));
  await executor.delete(workspaces).where(and(guest, notInArray(workspaces.id, recent)));
}

/** When the workspace was last planned, or `null` if it never was. */
export async function loadPlannedAt(tx: WorkspaceTx): Promise<Date | null> {
  const [{ plannedAt }] = await tx
    .select({ plannedAt: workspaces.plannedAt })
    .from(workspaces)
    .where(eq(workspaces.id, tx.workspaceId));
  return plannedAt;
}

export async function savePlannedAt(tx: WorkspaceTx, plannedAt: Date): Promise<void> {
  await tx.update(workspaces).set({ plannedAt }).where(eq(workspaces.id, tx.workspaceId));
}

/** Deletes the workspace's items, with their placements, and its categories; its settings stay. */
export async function clearWorkspace(tx: WorkspaceTx): Promise<void> {
  await tx.delete(fixedItems).where(ownedBy(tx, fixedItems));
  await tx.delete(tasks).where(ownedBy(tx, tasks));
  await tx.delete(categories).where(ownedBy(tx, categories));
}
