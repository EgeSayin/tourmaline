"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/server/db/client";
import { inWorkspace } from "@/server/db/workspace-transaction";
import { createGuestWorkspace, deleteIdleWorkspaces } from "@/server/db/workspaces-repository";
import { GUEST_IDLE_DAYS, GUEST_WORKSPACES_KEPT, SESSION_COOKIE_DAYS } from "@/server/workspaces/guest-limits";
import { DEMO_MODE, SESSION_COOKIE, sessionWorkspace, withWorkspace } from "@/server/workspaces/current-workspace";
import { seedWorkspace } from "./seed-workspace";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Starts the visitor in a guest workspace holding the sample week, unless their session is still live. */
export async function startDemoAction(): Promise<void> {
  if (!DEMO_MODE) throw new Error("Guest workspaces exist only in the demo");
  if (!(await sessionWorkspace())) {
    const now = new Date();
    await deleteIdleWorkspaces(db, new Date(now.getTime() - GUEST_IDLE_DAYS * MS_PER_DAY), GUEST_WORKSPACES_KEPT);
    const guest = await createGuestWorkspace(db);
    await inWorkspace(db, guest.workspaceId, (tx) => seedWorkspace(tx, now));
    (await cookies()).set(SESSION_COOKIE, guest.token, {
      httpOnly: true,
      secure: (await headers()).get("x-forwarded-proto") === "https",
      sameSite: "lax",
      maxAge: (SESSION_COOKIE_DAYS * MS_PER_DAY) / 1000,
    });
  }
  redirect("/");
}

export async function resetDemoAction(): Promise<void> {
  if (!DEMO_MODE) throw new Error("Only a demo workspace can be reset");
  await withWorkspace((tx) => seedWorkspace(tx, new Date()));
  refresh();
}
