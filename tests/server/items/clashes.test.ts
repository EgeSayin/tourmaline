import { describe, expect, it } from "vitest";
import type { Recurrence } from "@/lib/recurrence";
import { findClashes } from "@/server/items/clashes";
import { utc } from "../../support/intervals";
import { fixed, flexible } from "../../support/items";

const tz = "America/New_York";
const now = new Date("2026-10-07T16:00Z"); // Wed Oct 7, 12:00 EDT
const wednesdays: Recurrence = { frequency: "weekly", interval: 1, weekdays: [3], until: null };
const override = (date: string, state: { skipped?: boolean; bumped?: boolean }) => ({
  date,
  skipped: false,
  done: false,
  bumped: false,
  ...state,
});

describe("findClashes", { tags: ["unit"] }, () => {
  it("lists the fixed items an item's own times overlap, by start, telling mandatory ones apart", () => {
    const talk = fixed("Talk", utc("2026-10-08T21:30", "2026-10-08T23:00")); // Thu 17:30–19:00
    const club = { ...fixed("Club", utc("2026-10-08T22:00", "2026-10-09T00:00")), priority: "normal" as const };
    const seminar = fixed("Seminar", utc("2026-10-08T21:00", "2026-10-08T22:00"));
    const others = [
      club,
      seminar,
      fixed("Dinner", utc("2026-10-08T23:00", "2026-10-09T00:00")), // starts as the talk ends
      fixed("Buffered", utc("2026-10-08T20:00", "2026-10-08T21:30"), 0, 45), // only its buffer reaches in
      { ...fixed("Moved aside", utc("2026-10-08T21:30", "2026-10-08T23:00")), bumped: true },
      { ...talk, title: "Talk as stored" }, // the item itself, by id
      flexible("Essay", 60, utc("2026-10-08T21:30", "2026-10-08T23:00")), // tasks are planned around it
    ];

    expect(findClashes(talk, others, now, tz)).toEqual([
      { id: "Seminar", title: "Seminar", start: seminar.start, end: seminar.end, mandatory: true },
      { id: "Club", title: "Club", start: club.start, end: club.end, mandatory: false },
    ]);
    // A bumped item, or one that has ended, clashes with nothing.
    expect(findClashes({ ...talk, bumped: true }, others, now, tz)).toEqual([]);
    const yesterday = { ...talk, ...utc("2026-10-06T21:30", "2026-10-06T23:00") };
    expect(findClashes(yesterday, [{ ...club, ...yesterday, id: "Club" }], now, tz)).toEqual([]);
  });

  it("checks a series' occurrences from now up to the lookahead against other series', leaving out bumped and skipped ones", () => {
    // Wednesdays 17:30–19:00 from Sep 30; its Oct 14 occurrence is bumped.
    const talk = {
      ...fixed("Talk", utc("2026-09-30T21:30", "2026-09-30T23:00")),
      recurrence: wednesdays,
      overrides: [override("2026-10-14", { bumped: true })],
    };
    // Wednesdays 18:00–20:00 from Sep 2; Oct 21 is skipped. The lookahead ends Nov 4 at 11:00, before Nov 4's.
    const club = {
      ...fixed("Club", utc("2026-09-02T22:00", "2026-09-03T00:00")),
      recurrence: wednesdays,
      overrides: [override("2026-10-21", { skipped: true })],
    };

    expect(findClashes(talk, [club], now, tz).map((clash) => clash.id)).toEqual(["Club@2026-10-07", "Club@2026-10-28"]);
  });
});
