import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type DaySpan, type EditTarget, toCalendarBlocks, withLanes } from "@/lib/calendar-blocks";
import type { Item } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { utc } from "../support/intervals";
import { fixed, flexible } from "../support/items";

const tz = "America/New_York";

describe("toCalendarBlocks", () => {
  it("places blocks on their local day with a style per kind and state, their category's colour and their edit target, skipping items that are gone", () => {
    const cs = { id: "cs", name: "CSC 101", color: "green" } as const;
    const lecture = { ...fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15")), categoryId: cs.id }; // Mon 11:00–12:15 EDT
    const party = { ...fixed("Party", utc("2026-10-06T02:30", "2026-10-06T05:00")), priority: "normal" as const }; // Mon 22:30–01:00
    const reading = {
      ...flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T04:00"), "low"),
      categoryId: cs.id,
    };
    const placement = (
      taskId: string,
      times: { start: Date; end: Date },
      extra: Partial<Placement> = {},
    ): Placement => ({
      taskId,
      ...times,
      source: "auto",
      pinned: false,
      status: "planned",
      ...extra,
    });
    const placed = placement("Reading@2026-10-05", utc("2026-10-05T17:00", "2026-10-05T18:00")); // Mon 13:00–14:00
    const placedAgain = placement("Reading@2026-10-05", utc("2026-10-05T20:00", "2026-10-05T20:30"), { pinned: true });
    const deleted = placement("Deleted", utc("2026-10-05T21:00", "2026-10-05T22:00"));

    const items = new Map<string, Item>([lecture, party, reading].map((item) => [item.id, item]));
    const targetFor = (id: string): EditTarget | undefined => {
      const [itemId, date = null] = id.split("@");
      const item = items.get(itemId);
      return item && { item, occurrenceDate: date };
    };

    const blocks = toCalendarBlocks([lecture, party], [placed, placedAgain, deleted], tz, targetFor, [cs], placed.end);
    expect(new Set(blocks.map((block) => block.key)).size).toBe(blocks.length);
    expect(blocks).toEqual([
      {
        key: expect.any(String),
        title: "Lecture",
        start: lecture.start,
        end: lecture.end,
        style: "fixed",
        color: "green",
        date: "2026-10-05",
        startMinute: 11 * 60,
        endMinute: 12 * 60 + 15,
        lane: 0,
        lanes: 1,
        target: { item: lecture, occurrenceDate: null },
        placement: null,
        conflict: false,
      },
      {
        key: expect.any(String),
        title: "Party",
        start: party.start,
        end: party.end,
        style: "fixed-optional",
        color: null,
        date: "2026-10-05",
        startMinute: 22 * 60 + 30,
        endMinute: 24 * 60, // cut off at midnight
        lane: 0,
        lanes: 1,
        target: { item: party, occurrenceDate: null },
        placement: null,
        conflict: false,
      },
      ...(
        [
          [placed, 13 * 60, 14 * 60, "to-review", "to-review"], // ended by now
          [placedAgain, 16 * 60, 16 * 60 + 30, "scheduled", "planned"],
        ] as const
      ).map(([{ taskId, start, end, pinned }, startMinute, endMinute, style, state]) => ({
        key: expect.any(String),
        title: "Reading",
        start,
        end,
        style,
        color: "green",
        date: "2026-10-05",
        startMinute,
        endMinute,
        lane: 0,
        lanes: 1,
        target: { item: reading, occurrenceDate: "2026-10-05" },
        placement: { ref: { taskId, start }, state, pinned },
        conflict: false,
      })),
    ]);
  });
});

describe("conflicts", () => {
  it("marks fixed items that overlap each other, whatever their priority, and nothing else", () => {
    const lecture = fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T15:00"));
    const club = { ...fixed("Club", utc("2026-10-05T14:30", "2026-10-05T16:00")), priority: "low" as const };
    const dinner = fixed("Dinner", utc("2026-10-05T16:00", "2026-10-05T17:00")); // starts as the club ends
    const nextDay = fixed("Lecture again", utc("2026-10-06T14:00", "2026-10-06T15:00"));
    const reading = flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T04:00"));
    const done: Placement = {
      taskId: "Reading",
      ...utc("2026-10-05T16:00", "2026-10-05T17:00"), // overlaps the dinner
      source: "auto",
      pinned: false,
      status: "done",
    };
    const items = new Map<string, Item>([lecture, club, dinner, nextDay, reading].map((item) => [item.id, item]));
    const targetFor = (id: string): EditTarget | undefined => {
      const item = items.get(id);
      return item && { item, occurrenceDate: null };
    };

    const blocks = toCalendarBlocks([lecture, club, dinner, nextDay], [done], tz, targetFor, [], new Date());
    expect(blocks.map(({ title, conflict }) => `${title}: ${conflict}`)).toEqual([
      "Lecture: true",
      "Club: true",
      "Dinner: false",
      "Lecture again: false",
      "Reading: false",
    ]);
  });
});

describe("withLanes", () => {
  const span = (date: string, from: number, to: number): DaySpan => ({
    date,
    startMinute: from * 60,
    endMinute: to * 60,
  });
  const lanesOf = (spans: DaySpan[]) => withLanes(spans).map(({ lane, lanes }) => `${lane}/${lanes}`);

  it("puts overlapping blocks side by side, reusing a lane once it's free, and keeps the rest full width", () => {
    expect(
      lanesOf([
        span("2026-10-05", 10, 12), // overlaps both its neighbours
        span("2026-10-05", 9, 11),
        span("2026-10-05", 11, 13), // takes the 9:00 block's lane once it ends
        span("2026-10-05", 13, 14), // only touches the one before
        span("2026-10-06", 10, 11), // same time, another day
        span("2026-10-05", 15, 18),
        span("2026-10-05", 15.5, 16),
        span("2026-10-05", 16.5, 17), // beside the long block, in the lane the short one left
      ]),
    ).toEqual(["1/2", "0/2", "0/2", "0/1", "0/1", "0/2", "1/2", "1/2"]);
  });

  it("never puts overlapping blocks in one lane, and gives them the same lane count", () =>
    fc.assert(
      fc.property(
        fc.array(
          fc
            .tuple(
              fc.constantFrom("2026-10-05", "2026-10-06"),
              fc.integer({ min: 0, max: 1435 }),
              fc.integer({ min: 5, max: 300 }),
            )
            .map(([date, start, length]) => ({ date, startMinute: start, endMinute: Math.min(start + length, 1440) })),
          { maxLength: 15 },
        ),
        (spans) => {
          const laid = withLanes(spans);
          expect(laid.map(({ lane, lanes, ...span }) => span)).toEqual(spans);
          for (const a of laid) {
            expect(a.lane).toBeLessThan(a.lanes);
            for (const b of laid) {
              if (a !== b && a.date === b.date && a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
                expect(a.lane).not.toBe(b.lane);
                expect(a.lanes).toBe(b.lanes);
              }
            }
          }
        },
      ),
    ));
});
