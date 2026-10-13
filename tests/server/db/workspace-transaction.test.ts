import { sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import { insertItem } from "@/server/db/items-repository";
import { tasks, workspaces } from "@/server/db/schema";
import { enterWorkspace, inWorkspace, PERSONAL_WORKSPACE_ID } from "@/server/db/workspace-transaction";
import { createGuestWorkspace } from "@/server/db/workspaces-repository";
import { dbTest as it, savepoint } from "../../support/database";
import { utc } from "../../support/intervals";
import { flexible } from "../../support/items";

describe("inWorkspace", () => {
  it("runs one transaction at a time per workspace, and other workspaces' meanwhile", async ({ db }) => {
    const [a, b] = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"];
    const events: string[] = [];
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const firstStarted = new Promise<void>((resolve) => (started = resolve));

    const first = inWorkspace(db, a, async () => {
      events.push("a first starts");
      started();
      await released;
      events.push("a first ends");
    });
    await firstStarted;
    const second = inWorkspace(db, a, async () => {
      events.push("a second starts");
    });
    await inWorkspace(db, b, async () => {
      events.push("b runs");
    });
    await new Promise((resolve) => setTimeout(resolve, 200)); // time for the second to start, if it weren't held
    release();
    await Promise.all([first, second]);

    expect(events).toEqual(["a first starts", "b runs", "a first ends", "a second starts"]);
  });

  it("is held to its workspace's rows by the database itself, whatever a query asks for", async ({ tx }) => {
    const week = utc("2026-10-05T04:00", "2026-10-12T04:00");
    const guest = await createGuestWorkspace(tx);
    await insertItem(tx, flexible("Mine", 60, week));
    await savepoint(tx, (inner) => insertItem(inner, flexible("Theirs", 60, week)), guest.workspaceId);
    const titles = async (executor: typeof tx) =>
      (await executor.select({ title: tasks.title }).from(tasks)).map((row) => row.title).sort();

    await savepoint(tx, async (inner) => {
      const asGuest = await enterWorkspace(inner, guest.workspaceId);
      // No `ownedBy` here: only the policies keep these queries to the guest's rows.
      expect(await titles(asGuest)).toEqual(["Theirs"]);
      expect((await asGuest.select({ id: workspaces.id }).from(workspaces)).map((row) => row.id)).toEqual([
        guest.workspaceId,
      ]);
      await asGuest.update(tasks).set({ title: "Taken" });
      await expect(
        savepoint(asGuest, (nested) => insertItem(nested, flexible("Planted", 60, week)), PERSONAL_WORKSPACE_ID),
      ).rejects.toThrow();
      await asGuest.execute(sql`reset role`);
    });

    expect(await titles(tx)).toEqual(["Mine", "Taken"]);
  });
});
