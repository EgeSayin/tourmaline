import { describe, expect, it } from "vitest";
import { toCalendarBlocks } from "@/lib/calendar-blocks";
import { fixed, flexible } from "../support/items";
import { utc } from "../support/intervals";

const tz = "America/New_York";

describe("toCalendarBlocks", { tags: ["unit"] }, () => {
  it("places blocks on their local day with a style per kind, cutting off blocks that pass midnight, each with a unique key, and falls back to a placement's series", () => {
    const lecture = fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15")); // Mon 11:00–12:15 EDT
    const party = { ...fixed("Party", utc("2026-10-06T02:30", "2026-10-06T05:00")), priority: "normal" as const }; // Mon 22:30–01:00
    const reading = flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T04:00"), "low");
    const placed = utc("2026-10-05T17:00", "2026-10-05T18:00"); // Mon 13:00–14:00
    const placedAgain = utc("2026-10-05T20:00", "2026-10-05T20:30"); // Mon 16:00–16:30
    const placement = (times: typeof placed) => ({
      itemId: "Reading",
      ...times,
      source: "auto" as const,
      pinned: false,
    });

    const deleted = { ...placement(placed), itemId: "Deleted" }; // its task is gone, so it's skipped
    // The gym series no longer occurs on Tuesday, so that placement is shown under the series.
    const gym = { ...flexible("Gym", 60, utc("2026-10-05T14:00", "2026-10-06T14:00")), priority: "high" as const };
    const formerGym = { ...placement(utc("2026-10-06T15:00", "2026-10-06T16:00")), itemId: "Gym@2026-10-06" };
    const blocks = toCalendarBlocks(
      {
        items: [lecture, party, gym],
        fixedItems: [lecture, party],
        flexibleItems: [reading],
        placements: [placement(placed), placement(placedAgain), deleted, formerGym],
      },
      tz,
    );
    expect(new Set(blocks.map((block) => block.key)).size).toBe(blocks.length);
    expect(blocks).toEqual([
      {
        key: expect.any(String),
        item: lecture,
        start: lecture.start,
        end: lecture.end,
        style: "fixed",
        faded: false,
        date: "2026-10-05",
        startMinute: 11 * 60,
        endMinute: 12 * 60 + 15,
      },
      {
        key: expect.any(String),
        item: party,
        start: party.start,
        end: party.end,
        style: "fixed-optional",
        faded: false,
        date: "2026-10-05",
        startMinute: 22 * 60 + 30,
        endMinute: 24 * 60,
      },
      {
        key: expect.any(String),
        item: reading,
        ...placed,
        style: "scheduled",
        faded: true,
        date: "2026-10-05",
        startMinute: 13 * 60,
        endMinute: 14 * 60,
      },
      {
        key: expect.any(String),
        item: reading,
        ...placedAgain,
        style: "scheduled",
        faded: true,
        date: "2026-10-05",
        startMinute: 16 * 60,
        endMinute: 16 * 60 + 30,
      },
      {
        key: expect.any(String),
        item: gym,
        start: formerGym.start,
        end: formerGym.end,
        style: "scheduled",
        faded: false,
        date: "2026-10-06",
        startMinute: 11 * 60,
        endMinute: 12 * 60,
      },
    ]);
  });
});
