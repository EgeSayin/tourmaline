import { describe, expect } from "vitest";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import { insertItem, loadItems } from "@/server/db/items-repository";
import { items } from "@/server/db/schema";
import { dbTest as it } from "../../support/database";

const lecture: Omit<FixedItem, "id"> = {
  title: "CS 101 lecture",
  priority: "mandatory",
  timing: "fixed",
  start: new Date("2026-10-05T15:00:00Z"),
  end: new Date("2026-10-05T16:15:00Z"),
  location: "Science Hall 101",
  bufferBeforeMin: 15,
  bufferAfterMin: 10,
};

const essay: Omit<FlexibleItem, "id"> = {
  title: "Essay draft",
  priority: "high",
  timing: "flexible",
  durationMin: 120,
  earliestStart: new Date("2026-10-05T04:00:00Z"),
  deadline: new Date("2026-10-09T21:00:00Z"),
  split: { minChunkMin: 30, maxChunkMin: 90 },
  preferredWindows: [{ startMinute: 18 * 60, endMinute: 22 * 60 }],
  spread: "just-in-time",
};

describe("items repository", { tags: ["integration", "critical"] }, () => {
  it("reads back fixed and flexible items exactly as they were inserted", async ({ tx }) => {
    const lectureId = await insertItem(tx, lecture);
    const essayId = await insertItem(tx, essay);

    const loaded = await loadItems(tx);

    expect(loaded).toHaveLength(2);
    expect(loaded).toContainEqual({ id: lectureId, ...lecture });
    expect(loaded).toContainEqual({ id: essayId, ...essay });
  });

  it("refuses to load an item whose details row is missing", async ({ tx }) => {
    await tx.insert(items).values({ title: "Orphan", timing: "fixed" });

    await expect(loadItems(tx)).rejects.toThrow("has no details row");
  });
});
