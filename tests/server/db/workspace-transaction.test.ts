import { describe, expect } from "vitest";
import { inWorkspace } from "@/server/db/workspace-transaction";
import { dbTest as it } from "../../support/database";

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
});
