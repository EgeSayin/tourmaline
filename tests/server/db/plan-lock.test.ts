import { describe, expect } from "vitest";
import { inPlanTransaction } from "@/server/db/plan-lock";
import { dbTest as it } from "../../support/database";

describe("inPlanTransaction", () => {
  it("runs one plan transaction at a time", async ({ db }) => {
    const events: string[] = [];
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const firstStarted = new Promise<void>((resolve) => (started = resolve));

    const first = inPlanTransaction(db, async () => {
      events.push("first starts");
      started();
      await released;
      events.push("first ends");
    });
    await firstStarted;
    const second = inPlanTransaction(db, async () => {
      events.push("second starts");
    });
    await new Promise((resolve) => setTimeout(resolve, 200)); // time for the second to start, if it weren't held
    release();
    await Promise.all([first, second]);

    expect(events).toEqual(["first starts", "first ends", "second starts"]);
  });
});
