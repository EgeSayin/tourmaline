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
    // Mon 11:00–12:15 EDT, with 15 minutes before and 10 after.
    const lecture = { ...fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15"), 15, 10), categoryId: cs.id };
    // Mon 22:30–01:00, with half an hour after, all past midnight.
    const party = {
      ...fixed("Party", utc("2026-10-06T02:30", "2026-10-06T05:00"), 0, 30),
      priority: "normal" as const,
    };
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
        target: { item: lecture, occurrenceDate: null },
        placement: null,
        conflict: false,
        buffers: [
          { startMinute: 10 * 60 + 45, endMinute: 11 * 60 },
          { startMinute: 12 * 60 + 15, endMinute: 12 * 60 + 25 },
        ],
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
        target: { item: party, occurrenceDate: null },
        placement: null,
        conflict: false,
        buffers: [],
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
        target: { item: reading, occurrenceDate: "2026-10-05" },
        placement: { ref: { taskId, start }, state, pinned },
        conflict: false,
        buffers: [],
      })),
    ]);
  });
});

describe("conflicts", () => {
  it("marks fixed items that overlap each other, or a block that stays put, but not an optional one a more important block displaces", () => {
    const lecture = fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T15:00"));
    const club = { ...fixed("Club", utc("2026-10-05T14:30", "2026-10-05T16:00")), priority: "low" as const };
    const dinner = fixed("Dinner", utc("2026-10-05T16:00", "2026-10-05T17:00")); // starts as the club ends
    const nextDay = fixed("Lecture again", utc("2026-10-06T14:00", "2026-10-06T15:00"));
    const reading = flexible("Reading", 60, utc("2026-10-05T04:00", "2026-10-09T04:00"));
    const done: Placement = {
      taskId: "Reading",
      ...utc("2026-10-05T16:00", "2026-10-05T17:00"), // overlaps the dinner
      pinned: false,
      status: "done",
    };
    const block = (start: string, end: string, pinned: boolean): Placement => ({
      taskId: "Reading",
      ...utc(start, end),
      pinned,
      status: "planned",
    });
    const pinned = block("2026-10-06T14:30", "2026-10-06T15:00", true); // overlaps the next day's lecture
    const movable = block("2026-10-06T14:00", "2026-10-06T14:30", false); // so does this one, but it can move
    // An optional class gives way to a more important task's block, buffer included: displaced, not a conflict.
    const yoga = { ...fixed("Yoga", utc("2026-10-06T16:30", "2026-10-06T17:30"), 30), priority: "low" as const };
    const overYoga = block("2026-10-06T16:00", "2026-10-06T16:30", true);
    const items = new Map<string, Item>([lecture, club, dinner, nextDay, yoga, reading].map((item) => [item.id, item]));
    const targetFor = (id: string): EditTarget | undefined => {
      const item = items.get(id);
      return item && { item, occurrenceDate: null };
    };

    const now = new Date("2026-10-01T00:00Z");
    const blocks = toCalendarBlocks(
      [lecture, club, dinner, nextDay, yoga],
      [done, pinned, movable, overYoga],
      tz,
      targetFor,
      [],
      now,
    );
    expect(
      blocks.map(({ title, start, style, conflict }) => `${title} ${start.toISOString()} ${style}: ${conflict}`),
    ).toEqual([
      "Lecture 2026-10-05T14:00:00.000Z fixed: true",
      "Club 2026-10-05T14:30:00.000Z fixed-optional: true",
      "Dinner 2026-10-05T16:00:00.000Z fixed: true",
      "Lecture again 2026-10-06T14:00:00.000Z fixed: true",
      "Yoga 2026-10-06T16:30:00.000Z displaced: false",
      "Reading 2026-10-05T16:00:00.000Z done: true",
      "Reading 2026-10-06T14:30:00.000Z scheduled: true",
      "Reading 2026-10-06T14:00:00.000Z scheduled: false",
      "Reading 2026-10-06T16:00:00.000Z scheduled: false",
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
