import { describe, expect, it } from "vitest";
import { toCalendarBlocks } from "@/lib/calendar-blocks";
import { fixed, flexible } from "../support/items";

const tz = "America/New_York";
const utc = (start: string, end: string) => ({ start: new Date(`${start}Z`), end: new Date(`${end}Z`) });

describe("toCalendarBlocks", { tags: ["unit"] }, () => {
  it("places blocks on their local day with a style per kind, cutting off blocks that pass midnight", () => {
    const lecture = fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15")); // Mon 11:00–12:15 EDT
    const party = { ...fixed("Party", utc("2026-10-06T02:30", "2026-10-06T05:00")), priority: "normal" as const }; // Mon 22:30–01:00
    const reading = flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T04:00"), "low");
    const placed = utc("2026-10-05T17:00", "2026-10-05T18:00"); // Mon 13:00–14:00
    const placement = { itemId: "Reading", ...placed, source: "auto" as const, pinned: false };

    expect(toCalendarBlocks([lecture, party], [reading], [placement], tz)).toEqual([
      {
        key: "Lecture",
        title: "Lecture",
        start: lecture.start,
        end: lecture.end,
        style: "fixed",
        faded: false,
        date: "2026-10-05",
        startMinute: 11 * 60,
        endMinute: 12 * 60 + 15,
      },
      {
        key: "Party",
        title: "Party",
        start: party.start,
        end: party.end,
        style: "fixed-optional",
        faded: false,
        date: "2026-10-05",
        startMinute: 22 * 60 + 30,
        endMinute: 24 * 60,
      },
      {
        key: "Reading",
        title: "Reading",
        ...placed,
        style: "scheduled",
        faded: true,
        date: "2026-10-05",
        startMinute: 13 * 60,
        endMinute: 14 * 60,
      },
    ]);
  });
});
