import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db/client";
import { inWorkspace, PERSONAL_WORKSPACE_ID, type WorkspaceTx } from "@/server/db/workspace-transaction";
import { openSession } from "@/server/db/workspaces-repository";
import { replanWorkspace } from "@/server/planning/saved-plan";

/** The public demo: each visitor gets a guest workspace of their own. Otherwise there is one personal workspace. */
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const SESSION_COOKIE = "session";

/** Where a demo visitor without a session starts one. */
export const WELCOME_PATH = "/welcome";

/** The workspace of the request's live session, if it has one. */
export const sessionWorkspace = cache(async (): Promise<string | undefined> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? openSession(db, token, new Date()) : undefined;
});

/** The request's workspace, sending a demo visitor without a live session to the welcome page. */
export async function currentWorkspace(): Promise<string> {
  if (!DEMO_MODE) return PERSONAL_WORKSPACE_ID;
  return (await sessionWorkspace()) ?? redirect(WELCOME_PATH);
}

/** Runs `work` in the request's workspace (see `inWorkspace`). */
export async function withWorkspace<T>(work: (tx: WorkspaceTx) => Promise<T>): Promise<T> {
  return inWorkspace(db, await currentWorkspace(), work);
}

/** Runs `work`, a change to what the plan is made from, in the request's workspace, then plans it again. */
export async function changeWorkspace<T>(work: (tx: WorkspaceTx) => Promise<T>): Promise<T> {
  return withWorkspace(async (tx) => {
    const result = await work(tx);
    await replanWorkspace(tx, new Date());
    return result;
  });
}
