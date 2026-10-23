import { count, eq, sql } from "drizzle-orm";
import type { Account } from "@/lib/accounts";
import { addMinutes } from "@/lib/time/duration";
import { signInPauseMin } from "@/server/accounts/account-limits";
import type { Executor } from "./connection";
import { instance, users } from "./schema";
import { createSession, createWorkspace } from "./workspaces-repository";

export type NewAccount =
  { ok: true; userId: string; workspaceId: string; token: string } | { ok: false; reason: "taken" | "closed" };

/**
 * A new account with an empty workspace, signed in. The first account is the admin and can always be created;
 * after it, only while sign-up is open.
 */
export function createAccount(executor: Executor, username: string, passwordHash: string): Promise<NewAccount> {
  return executor.transaction(async (tx) => {
    // Holds other sign-ups back, so only one can be the first.
    const [{ signUpOpen }] = await tx.select().from(instance).for("update");
    const [{ accounts }] = await tx.select({ accounts: count() }).from(users);
    if (accounts > 0 && !signUpOpen) return { ok: false, reason: "closed" };
    if (await findAccount(tx, username)) return { ok: false, reason: "taken" };

    const workspaceId = await createWorkspace(tx);
    const [{ userId }] = await tx
      .insert(users)
      .values({ username, passwordHash, workspaceId, isAdmin: accounts === 0 })
      .returning({ userId: users.id });
    return { ok: true, userId, workspaceId, token: await createSession(tx, workspaceId, userId) };
  });
}

export interface StoredAccount extends Account {
  passwordHash: string;
  workspaceId: string;
  signInPausedUntil: Date | null;
}

export async function findAccount(executor: Executor, username: string): Promise<StoredAccount | undefined> {
  const [account] = await executor
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      passwordHash: users.passwordHash,
      workspaceId: users.workspaceId,
      signInPausedUntil: users.signInPausedUntil,
    })
    .from(users)
    .where(eq(users.username, username));
  return account;
}

export async function loadAccount(executor: Executor, userId: string): Promise<Account | undefined> {
  const [account] = await executor
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId));
  return account;
}

/** Counts a wrong password; returns until when sign-in is now paused, or `null` if it isn't. */
export async function recordFailedSignIn(executor: Executor, userId: string, now: Date): Promise<Date | null> {
  const [{ failures }] = await executor
    .update(users)
    .set({ failedSignIns: sql`${users.failedSignIns} + 1` })
    .where(eq(users.id, userId))
    .returning({ failures: users.failedSignIns });
  const pauseMin = signInPauseMin(failures);
  if (pauseMin === 0) return null;
  const until = addMinutes(now, pauseMin);
  await executor.update(users).set({ signInPausedUntil: until }).where(eq(users.id, userId));
  return until;
}

export async function recordSignIn(executor: Executor, userId: string): Promise<void> {
  await executor.update(users).set({ failedSignIns: 0, signInPausedUntil: null }).where(eq(users.id, userId));
}

export async function savePassword(executor: Executor, userId: string, passwordHash: string): Promise<void> {
  await executor.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function hasAccounts(executor: Executor): Promise<boolean> {
  const [{ accounts }] = await executor.select({ accounts: count() }).from(users);
  return accounts > 0;
}

export async function loadSignUpOpen(executor: Executor): Promise<boolean> {
  const [{ signUpOpen }] = await executor.select({ signUpOpen: instance.signUpOpen }).from(instance);
  return signUpOpen;
}

export async function saveSignUpOpen(executor: Executor, signUpOpen: boolean): Promise<void> {
  await executor.update(instance).set({ signUpOpen });
}
