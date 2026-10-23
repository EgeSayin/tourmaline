import { sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import { insertItem } from "@/server/db/items-repository";
import { tasks, workspaces } from "@/server/db/schema";
import { enterWorkspace, inWorkspace } from "@/server/db/workspace-transaction";
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
        savepoint(asGuest, (nested) => insertItem(nested, flexible("Planted", 60, week)), tx.workspaceId),
      ).rejects.toThrow();
      await asGuest.execute(sql`reset role`);
    });

    expect(await titles(tx)).toEqual(["Mine", "Taken"]);
  });

  it("is held by every table with a workspace's rows, and reaches no other table", async ({ tx }) => {
    // Read and written only by session code, as the owner.
    const ownerOnly = ["sessions", "users"];
    const tables = await tx.execute<{
      name: string;
      scoped: boolean;
      guarded: boolean;
      any: boolean;
      all: boolean;
    }>(sql`
      select c.relname as name,
        c.relname = 'workspaces' or exists (
          select from pg_attribute a where a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped
        ) as scoped,
        c.relrowsecurity and exists (
          select from pg_policy p where p.polrelid = c.oid and p.polname = 'own_rows'
        ) as guarded,
        has_table_privilege('workspace_user', c.oid, 'select, insert, update, delete') as any,
        (select bool_and(has_table_privilege('workspace_user', c.oid, privilege))
          from unnest(array['select', 'insert', 'update', 'delete']) privilege) as all
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    const names = (has: (table: (typeof tables)[number]) => boolean) => tables.filter(has).map((table) => table.name);
    const held = names((table) => table.scoped && !ownerOnly.includes(table.name));

    expect(held).toContain("placements");
    expect(names((table) => table.guarded)).toEqual(held);
    expect(names((table) => table.any)).toEqual(held);
    expect(names((table) => table.all)).toEqual(held);
  });
});
