import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { cache } from "react";
import type { FormState } from "@/lib/form-state";
import { db } from "@/server/db/client";
import {
  inWorkspace,
  PERSONAL_WORKSPACE_ID,
  readInWorkspace,
  type WorkspaceTx,
} from "@/server/db/workspace-transaction";
import { openSession } from "@/server/db/workspaces-repository";
import { plannedToday, replanWorkspace } from "@/server/planning/saved-plan";

/** The public demo: each visitor gets a guest workspace of their own. Otherwise there is one personal workspace. */
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const SESSION_COOKIE = "session";

/** Where a demo visitor without a session starts one. */
const WELCOME_PATH = "/welcome";

/** The workspace of the request's live session, if it has one. */
export const sessionWorkspace = cache(async (): Promise<string | undefined> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? openSession(db, token, new Date()) : undefined;
});

/** The request's workspace, sending a demo visitor without a live session to the welcome page. */
async function currentWorkspace(): Promise<string> {
  if (!DEMO_MODE) return PERSONAL_WORKSPACE_ID;
  return (await sessionWorkspace()) ?? redirect(WELCOME_PATH);
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
 * refreshes the page. `replan: false` is for changes to what the plan isn't made from.
 */
export async function changeWorkspace(work: Change<unknown>, { replan = true } = {}): Promise<void> {
  await change(work, () => true, replan);
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
