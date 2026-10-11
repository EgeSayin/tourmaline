import { describe, expect, it } from "vitest";
import { type EditTarget, toCalendarBlocks } from "@/lib/calendar-blocks";
import type { Item } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { utc } from "../support/intervals";
import { fixed, flexible } from "../support/items";

const tz = "America/New_York";

describe("toCalendarBlocks", { tags: ["unit"] }, () => {
  it("places blocks on their local day with a style per kind and their edit target, skipping items that are gone", () => {
    const lecture = fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15")); // Mon 11:00–12:15 EDT
    const party = { ...fixed("Party", utc("2026-10-06T02:30", "2026-10-06T05:00")), priority: "normal" as const }; // Mon 22:30–01:00
    const reading = flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T04:00"), "low");
    const placement = (taskId: string, times: { start: Date; end: Date }): Placement => ({
      taskId,
      ...times,
      source: "auto",
      pinned: false,
      status: "planned",
    });
    const placed = placement("Reading@2026-10-05", utc("2026-10-05T17:00", "2026-10-05T18:00")); // Mon 13:00–14:00
    const placedAgain = placement("Reading@2026-10-05", utc("2026-10-05T20:00", "2026-10-05T20:30"));
    const deleted = placement("Deleted", utc("2026-10-05T21:00", "2026-10-05T22:00"));

    const items = new Map<string, Item>([lecture, party, reading].map((item) => [item.id, item]));
    const targetFor = (id: string): EditTarget | undefined => {
      const [itemId, date = null] = id.split("@");
      const item = items.get(itemId);
      return item && { item, occurrenceDate: date };
    };

    const blocks = toCalendarBlocks([lecture, party], [placed, placedAgain, deleted], tz, targetFor);
    expect(new Set(blocks.map((block) => block.key)).size).toBe(blocks.length);
    expect(blocks).toEqual([
      {
        key: expect.any(String),
        title: "Lecture",
        start: lecture.start,
        end: lecture.end,
        style: "fixed",
        faded: false,
        date: "2026-10-05",
        startMinute: 11 * 60,
        endMinute: 12 * 60 + 15,
        target: { item: lecture, occurrenceDate: null },
      },
      {
        key: expect.any(String),
        title: "Party",
        start: party.start,
        end: party.end,
        style: "fixed-optional",
        faded: false,
        date: "2026-10-05",
        startMinute: 22 * 60 + 30,
        endMinute: 24 * 60, // cut off at midnight
        target: { item: party, occurrenceDate: null },
      },
      ...(
        [
          [placed, 13 * 60, 14 * 60],
          [placedAgain, 16 * 60, 16 * 60 + 30],
        ] as const
      ).map(([{ start, end }, startMinute, endMinute]) => ({
        key: expect.any(String),
        title: "Reading",
        start,
        end,
        style: "scheduled",
        faded: true, // low priority
        date: "2026-10-05",
        startMinute,
        endMinute,
        target: { item: reading, occurrenceDate: "2026-10-05" },
      })),
    ]);
  });
});
