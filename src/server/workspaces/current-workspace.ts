import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { cache } from "react";
import type { Account } from "@/lib/accounts";
import type { FormState } from "@/lib/form-state";
import { loadAccount } from "@/server/db/accounts-repository";
import { db } from "@/server/db/client";
import { inWorkspace, readInWorkspace, type WorkspaceTx } from "@/server/db/workspace-transaction";
import { type OpenSession, openSession } from "@/server/db/workspaces-repository";
import { plannedToday, replanWorkspace } from "@/server/planning/saved-plan";
import { SESSION_TOUCH_MIN } from "./guest-limits";
import { SESSION_COOKIE } from "./session-cookie";

/** The public demo: each visitor gets a guest workspace of their own. Otherwise each account has one. */
export const DEMO_MODE = process.env.DEMO_MODE === "true";

/** Where a demo visitor without a session starts one. */
const WELCOME_PATH = "/welcome";

export const SIGN_IN_PATH = "/sign-in";

/** The request's live session, if it has one: a guest's in the demo, otherwise an account's. */
export const currentSession = cache(async (): Promise<OpenSession | undefined> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await openSession(db, token, new Date(), SESSION_TOUCH_MIN) : undefined;
  return session && (session.userId === null) === DEMO_MODE ? session : undefined;
});

export async function sessionWorkspace(): Promise<string | undefined> {
  return (await currentSession())?.workspaceId;
}

/** The signed-in account; `undefined` in the demo. */
export const currentAccount = cache(async (): Promise<Account | undefined> => {
  const userId = (await currentSession())?.userId;
  return userId ? loadAccount(db, userId) : undefined;
});

/** The request's workspace, sending a visitor without a live session to where they start one. */
async function currentWorkspace(): Promise<string> {
  return (await sessionWorkspace()) ?? redirect(DEMO_MODE ? WELCOME_PATH : SIGN_IN_PATH);
}

/**
 * Runs `work`, which only reads, in the request's workspace on one consistent snapshot, without waiting for its lock.
 * The first read on a local day plans the workspace again first (see `plannedToday`).
 */
export async function readWorkspace<T>(work: (tx: WorkspaceTx, now: Date) => Promise<T>): Promise<T> {
  const workspaceId = await currentWorkspace();
  const now = new Date();
  if (!(await readInWorkspace(db, workspaceId, (tx) => plannedToday(tx, now)))) {
    await inWorkspace(db, workspaceId, async (tx) => {
      // Another request may have planned it meanwhile.
      if (!(await plannedToday(tx, now))) await replanWorkspace(tx, now);
    });
  }
  return readInWorkspace(db, workspaceId, (tx) => work(tx, now));
}

type Change<T> = (tx: WorkspaceTx, now: Date) => Promise<T>;

/**
 * Runs `work`, a change, in the request's workspace holding its lock (see `inWorkspace`), then plans it again and
 * refreshes the page, and returns what `work` did. `replan: false` is for changes to what the plan isn't made from.
 */
export function changeWorkspace<T>(work: Change<T>, { replan = true } = {}): Promise<T> {
  return change(work, () => true, replan);
}

/** Like `changeWorkspace`, for a form: an invalid one changed nothing, so it isn't planned again or refreshed. */
export function changeWorkspaceForm(work: Change<FormState>, { replan = true } = {}): Promise<FormState> {
  return change(work, (state) => state.status !== "invalid", replan);
}

async function change<T>(work: Change<T>, changed: (result: T) => boolean, replan: boolean): Promise<T> {
  const now = new Date();
  const result = await inWorkspace(db, await currentWorkspace(), async (tx) => {
    const result = await work(tx, now);
    if (replan && changed(result)) await replanWorkspace(tx, now);
    return result;
  });
  if (changed(result)) refresh();
  return result;
}
