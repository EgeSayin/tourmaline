import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, lt, ne, notInArray } from "drizzle-orm";
import type { Executor } from "./connection";
import { categories, fixedItems, sessions, settings, tasks, workspaces } from "./schema";
import { ownedBy, PERSONAL_WORKSPACE_ID, type WorkspaceTx } from "./workspace-transaction";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new workspace with default settings, and the token of a session in it. */
export async function createGuestWorkspace(executor: Executor): Promise<{ workspaceId: string; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const workspaceId = await executor.transaction(async (tx) => {
    const [{ id }] = await tx.insert(workspaces).values({}).returning({ id: workspaces.id });
    await tx.insert(settings).values({ workspaceId: id });
    await tx.insert(sessions).values({ tokenHash: hash(token), workspaceId: id });
    return id;
  });
  return { workspaceId, token };
}

/** The workspace of the session `token` opens, marked as used `now`; `undefined` once it was deleted. */
export async function openSession(executor: Executor, token: string, now: Date): Promise<string | undefined> {
  const [session] = await executor
    .select({ workspaceId: sessions.workspaceId })
    .from(sessions)
    .where(eq(sessions.tokenHash, hash(token)));
  if (!session) return undefined;
  await executor.update(workspaces).set({ lastUsedAt: now }).where(eq(workspaces.id, session.workspaceId));
  return session.workspaceId;
}

/** Deletes guest workspaces unused since `idleSince`, and all but the `keep` most recently used. */
export async function deleteIdleWorkspaces(executor: Executor, idleSince: Date, keep: number): Promise<void> {
  const recent = executor
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(ne(workspaces.id, PERSONAL_WORKSPACE_ID))
    .orderBy(desc(workspaces.lastUsedAt))
    .limit(keep);
  await executor
    .delete(workspaces)
    .where(and(ne(workspaces.id, PERSONAL_WORKSPACE_ID), lt(workspaces.lastUsedAt, idleSince)));
  await executor
    .delete(workspaces)
    .where(and(ne(workspaces.id, PERSONAL_WORKSPACE_ID), notInArray(workspaces.id, recent)));
}

/** Deletes the workspace's items, with their placements, and its categories; its settings stay. */
export async function clearWorkspace(tx: WorkspaceTx): Promise<void> {
  await tx.delete(fixedItems).where(ownedBy(tx, fixedItems));
  await tx.delete(tasks).where(ownedBy(tx, tasks));
  await tx.delete(categories).where(ownedBy(tx, categories));
}
