import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { deleteCategory, insertCategory, loadCategories } from "@/server/db/categories-repository";
import { deleteItem, loadItems, updateItem } from "@/server/db/items-repository";
import { loadPlacements } from "@/server/db/placements-repository";
import { workspaces } from "@/server/db/schema";
import { loadSettings } from "@/server/db/settings-repository";
import { PERSONAL_WORKSPACE_ID } from "@/server/db/workspace-transaction";
import { createGuestWorkspace, deleteIdleWorkspaces, openSession } from "@/server/db/workspaces-repository";
import { seedWorkspace } from "@/server/demo/seed-workspace";
import { SESSION_TOUCH_MIN } from "@/server/workspaces/guest-limits";
import { addMinutes } from "@/lib/time/duration";
import { dbTest as it, savepoint } from "../../support/database";
import { utc } from "../../support/intervals";

const now = new Date("2026-10-07T16:00Z");
const week = utc("2026-10-01T00:00", "2026-10-15T00:00");

describe("guest workspaces", () => {
  it("each sees and changes only its own data, through a session only its token opens", async ({ tx }) => {
    const guest = await createGuestWorkspace(tx);
    expect(await openSession(tx, guest.token, now, SESSION_TOUCH_MIN)).toBe(guest.workspaceId);
    expect(await openSession(tx, `${guest.token}x`, now, SESSION_TOUCH_MIN)).toBeUndefined();

    const inGuest = <T>(work: Parameters<typeof savepoint<T>>[1]) => savepoint(tx, work, guest.workspaceId);
    await inGuest((guestTx) => seedWorkspace(guestTx, now));
    await insertCategory(tx, { name: "CS 101", color: "#ef4444" }); // the same name as a guest's is fine
    const [guestItem] = await inGuest(loadItems);
    const [guestCategory] = await inGuest(loadCategories);

    expect(await inGuest((guestTx) => loadPlacements(guestTx, week))).not.toEqual([]);
    expect(await inGuest(loadSettings)).toMatchObject({ timeZone: "America/New_York" });
    expect(await loadItems(tx)).toEqual([]);
    expect(await loadPlacements(tx, week)).toEqual([]);
    expect((await loadCategories(tx)).map((category) => category.name)).toEqual(["CS 101"]);
    await updateItem(tx, guestItem.id, { ...guestItem, title: "Taken over" }, {});
    await deleteItem(tx, guestItem);
    expect(await deleteCategory(tx, guestCategory.id)).toBe(false);
    expect((await inGuest(loadItems)).map((item) => item.title)).toContain(guestItem.title);
  });

  it("are deleted once idle or beyond the most kept, with their sessions; the personal one never is", async ({
    tx,
  }) => {
    const [idle, older, recent] = [
      await createGuestWorkspace(tx),
      await createGuestWorkspace(tx),
      await createGuestWorkspace(tx),
    ];
    const usedAt = (guest: typeof idle, date: string) =>
      tx
        .update(workspaces)
        .set({ lastUsedAt: new Date(date) })
        .where(eq(workspaces.id, guest.workspaceId));
    await usedAt(idle, "2026-09-01T00:00Z");
    await usedAt(older, "2026-10-05T00:00Z");
    await usedAt(recent, "2026-10-06T00:00Z");
    await tx
      .update(workspaces)
      .set({ lastUsedAt: new Date("2026-01-01T00:00Z") })
      .where(eq(workspaces.id, PERSONAL_WORKSPACE_ID));

    await deleteIdleWorkspaces(tx, new Date("2026-09-30T00:00Z"), 1);

    const left = await tx.select({ id: workspaces.id }).from(workspaces);
    expect(left.map((workspace) => workspace.id).sort()).toEqual([PERSONAL_WORKSPACE_ID, recent.workspaceId].sort());
    expect(await openSession(tx, idle.token, now, SESSION_TOUCH_MIN)).toBeUndefined();
    expect(await openSession(tx, recent.token, now, SESSION_TOUCH_MIN)).toBe(recent.workspaceId);

    // Opening it marks it used, but not again within `SESSION_TOUCH_MIN`.
    const lastUsed = async () =>
      (await tx.select().from(workspaces).where(eq(workspaces.id, recent.workspaceId)))[0].lastUsedAt;
    expect(await lastUsed()).toEqual(now);
    await openSession(tx, recent.token, addMinutes(now, SESSION_TOUCH_MIN - 1), SESSION_TOUCH_MIN);
    expect(await lastUsed()).toEqual(now);
    const later = addMinutes(now, SESSION_TOUCH_MIN + 1);
    await openSession(tx, recent.token, later, SESSION_TOUCH_MIN);
    expect(await lastUsed()).toEqual(later);
  });
});
