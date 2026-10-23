"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { addMinutes } from "@/lib/time/duration";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import { db } from "@/server/db/client";
import { inWorkspace } from "@/server/db/workspace-transaction";
import { createGuestWorkspace, deleteIdleWorkspaces } from "@/server/db/workspaces-repository";
import { GUEST_IDLE_DAYS, GUEST_WORKSPACES_KEPT, SESSION_COOKIE_DAYS } from "@/server/workspaces/guest-limits";
import { DEMO_MODE, changeWorkspace, sessionWorkspace } from "@/server/workspaces/current-workspace";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/workspaces/session-cookie";
import { seedWorkspace } from "./seed-workspace";

/** Starts the visitor in a guest workspace holding the sample week, unless their session is still live. */
export async function startDemoAction(): Promise<void> {
  if (!DEMO_MODE) throw new Error("Guest workspaces exist only in the demo");
  if (!(await sessionWorkspace())) {
    const now = new Date();
    await deleteIdleWorkspaces(db, addMinutes(now, -GUEST_IDLE_DAYS * MINUTES_PER_DAY), GUEST_WORKSPACES_KEPT);
    const guest = await createGuestWorkspace(db);
    await inWorkspace(db, guest.workspaceId, (tx) => seedWorkspace(tx, now));
    (await cookies()).set(
      SESSION_COOKIE,
      guest.token,
      sessionCookieOptions(SESSION_COOKIE_DAYS, (await headers()).get("x-forwarded-proto") === "https"),
    );
  }
  redirect("/");
}

export async function resetDemoAction(): Promise<void> {
  if (!DEMO_MODE) throw new Error("Only a demo workspace can be reset");
  await changeWorkspace(seedWorkspace, { replan: false });
}
