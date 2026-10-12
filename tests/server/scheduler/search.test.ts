import { nightly } from "@/lib/downtime";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SLOT_MIN } from "@/lib/placements";
import { NO_FOCUS_CAPS, type SchedulerSettings } from "@/lib/settings";
import { minutesBetween } from "@/lib/time/duration";
import { type Interval, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import { freeTimeMap } from "@/server/scheduler/free-time";
import {
  evenTargets,
  findEarliestChunks,
  findEarliestSlot,
  findEvenChunks,
  findLatestChunks,
  findLatestSlot,
} from "@/server/scheduler/search";
import { at, covers, intervalArb, intervalsArb, iv, minuteOf, SPAN_MIN, utc } from "../../support/intervals";
import { fixed, splitArb, taskMinutesArb } from "../../support/items";

/** Earliest minute on the `SLOT_MIN` grid starting `durationMin` consecutive minutes inside both `free` and `window`. */
function earliestFittingMinute(free: readonly Interval[], window: Interval, durationMin: number): number | null {
  const run = new Array<number>(SPAN_MIN + 1).fill(0);
  for (let minute = SPAN_MIN - 1; minute >= 0; minute--) {
    run[minute] = covers(free, minute) && covers([window], minute) ? run[minute + 1] + 1 : 0;
  }
  const start = run.findIndex((length, minute) => minute % SLOT_MIN === 0 && length >= durationMin);
  return start === -1 ? null : start;
}

describe("findEarliestSlot", () => {
  it("returns the earliest free block that fits the duration inside the window", () => {
    const free = mergeIntervals([iv("10:00", "10:45"), iv("12:30", "18:00"), iv("19:00", "22:30")]);
    const day = iv("00:00", "23:59");

    expect(findEarliestSlot(free, 30, day)).toEqual(iv("10:00", "10:30"));
    expect(findEarliestSlot(free, 60, day)).toEqual(iv("12:30", "13:30")); // first slot too short
    expect(findEarliestSlot(free, 45, iv("00:00", "10:45"))).toEqual(iv("10:00", "10:45")); // ends exactly at deadline
    expect(findEarliestSlot(free, 60, iv("13:00", "23:59"))).toEqual(iv("13:00", "14:00")); // starts mid-slot
    expect(findEarliestSlot(free, 60, iv("00:00", "13:15"))).toBeNull(); // deadline cuts the slot short
    expect(findEarliestSlot(free, 6 * 60, day)).toBeNull(); // longer than any free block
    expect(findEarliestSlot(mergeIntervals([iv("10:03", "10:40")]), 30, day)).toEqual(iv("10:05", "10:35")); // rounded up to the grid
    expect(findEarliestSlot(mergeIntervals([iv("10:03", "10:29")]), 25, day)).toBeNull(); // fits only off the grid
  });

  it("returns a slot at the earliest grid minute that fits, or null when none does", () => {
    const freeArb = intervalsArb.map(mergeIntervals);
    const durationArb = fc.integer({ min: 1, max: 8 * 60 });

    fc.assert(
      fc.property(freeArb, intervalArb(SPAN_MIN), durationArb, (free, window, durationMin) => {
        const start = earliestFittingMinute(free, window, durationMin);
        const expected = start === null ? null : { start: at(start), end: at(start + durationMin) };

        expect(findEarliestSlot(free, durationMin, window)).toEqual(expected);
      }),
    );
  });
});

describe("findEarliestChunks", () => {
  const split = { minChunkMin: 30, maxChunkMin: 60 };
  const free = mergeIntervals([iv("10:00", "11:00"), iv("11:10", "12:00"), iv("13:00", "17:00")]);
  const day = iv("00:00", "23:59");

  it("cuts a task into the earliest chunks that fit, with a break after each", () => {
    // 60, then 30 after the break (the slot left at 11:30 is short), then the last 60.
    expect(findEarliestChunks(free, 150, day, split, 30)).toEqual([
      iv("10:00", "11:00"),
      iv("11:30", "12:00"),
      iv("13:00", "14:00"),
    ]);
    // 60 and 10 would leave a chunk below the minimum, so 40 and 30.
    expect(findEarliestChunks(mergeIntervals([iv("13:00", "17:00")]), 70, day, split, 30)).toEqual([
      iv("13:00", "13:40"),
      iv("14:10", "14:40"),
    ]);
    // Shorter than the minimum: one short chunk.
    expect(findEarliestChunks(free, 20, day, split, 30)).toEqual([iv("10:00", "10:20")]);
    // Rounded up to the grid after a break that ends off it.
    expect(findEarliestChunks(free, 90, day, split, 23)).toEqual([iv("10:00", "11:00"), iv("11:25", "11:55")]);
    // A full first hour would leave 85, which no 45 to 60 chunks add up to, so 55, then 45 and 45.
    const narrow = mergeIntervals([iv("08:30", "09:30"), iv("10:30", "12:00"), iv("12:30", "13:15")]);
    expect(findEarliestChunks(narrow, 145, day, { minChunkMin: 45, maxChunkMin: 60 }, 30)).toEqual([
      iv("08:30", "09:25"),
      iv("10:30", "11:15"),
      iv("12:30", "13:15"),
    ]);
    // A longest first chunk would leave 105 for the hour-long slots, so 90, then 60 and 60.
    const hours = mergeIntervals([iv("09:30", "12:00"), iv("14:00", "15:00"), iv("17:30", "18:30")]);
    expect(findEarliestChunks(hours, 210, day, { minChunkMin: 60, maxChunkMin: 105 }, 30)).toEqual([
      iv("09:30", "11:00"),
      iv("14:00", "15:00"),
      iv("17:30", "18:30"),
    ]);
  });

  it("finds chunks whenever there are some, so more free time never makes it fail", () => {
    fc.assert(
      fc.property(
        intervalsArb.map(mergeIntervals),
        intervalsArb,
        taskMinutesArb(SLOT_MIN, 6 * 60),
        splitArb,
        fc.integer({ min: 0, max: 90 }),
        (free, extra, durationMin, split, breakMin) => {
          const window = { start: at(0), end: at(SPAN_MIN) };
          if (!findEarliestChunks(free, durationMin, window, split, breakMin)) return;
          expect(
            findEarliestChunks(mergeIntervals([...free, ...extra]), durationMin, window, split, breakMin),
          ).not.toBeNull();
        },
      ),
    );
  });

  it("returns null unless all of the time fits", () => {
    expect(findEarliestChunks(free, 120, iv("00:00", "12:00"), split, 30)).toBeNull(); // 90 fits before noon
    expect(findEarliestChunks(mergeIntervals([iv("10:00", "10:25")]), 30, day, split, 30)).toBeNull();
    // 50 can't be cut into chunks of 30 to 40.
    expect(findEarliestChunks(free, 50, day, { minChunkMin: 30, maxChunkMin: 40 }, 0)).toBeNull();
  });
});

describe("evenTargets", () => {
  const settings: SchedulerSettings = {
    timeZone: "UTC",
    downtime: nightly(22 * 60, 10 * 60),
    focusCaps: NO_FOCUS_CAPS,
  };
  const threeDays = utc("2026-10-05T00:00", "2026-10-08T00:00"); // free 10:00–22:00 each day

  it("centres each block in an equal share of the free time, skipping busy stretches", () => {
    const free = freeTimeMap(threeDays, [], settings);
    // 12 free hours each, so each 60-minute chunk is centred in a day: 5h30 after 10:00.
    expect(evenTargets(free, threeDays, 180, 3)).toEqual([
      new Date("2026-10-05T15:30Z"),
      new Date("2026-10-06T15:30Z"),
      new Date("2026-10-07T15:30Z"),
    ]);

    // Tuesday is full, so two chunks share Monday's and Wednesday's free time.
    const busyTuesday = freeTimeMap(
      threeDays,
      [fixed("Exam day", utc("2026-10-06T10:00", "2026-10-06T22:00"))],
      settings,
    );
    expect(evenTargets(busyTuesday, threeDays, 120, 2)).toEqual([
      new Date("2026-10-05T15:30Z"),
      new Date("2026-10-07T15:30Z"),
    ]);

    // One block sits in the middle of the free time.
    const monday = utc("2026-10-05T00:00", "2026-10-06T00:00");
    expect(evenTargets(freeTimeMap(monday, [], settings), monday, 90, 1)).toEqual([new Date("2026-10-05T15:15Z")]);
    expect(evenTargets(mergeIntervals([]), monday, 90, 2)).toEqual([monday.start, monday.start]);
  });
});

describe("findEvenChunks", () => {
  const settings: SchedulerSettings = {
    timeZone: "UTC",
    downtime: nightly(22 * 60, 10 * 60),
    focusCaps: NO_FOCUS_CAPS,
  };
  const fiveDays = utc("2026-10-05T00:00", "2026-10-10T00:00"); // free 10:00–22:00 each day
  const split = { minChunkMin: 60, maxChunkMin: 120 };

  it("cuts as many equal chunks as the minimum allows, each centred in its share of the free time", () => {
    const free = freeTimeMap(fiveDays, [], settings);
    const days = ["05", "06", "07", "08", "09"];

    expect(findEvenChunks(free, 5 * 60, fiveDays, split, 30)).toEqual(
      days.map((day) => utc(`2026-10-${day}T15:30`, `2026-10-${day}T16:30`)),
    );
    const uneven = findEvenChunks(free, 340, fiveDays, split, 30)!;
    expect(uneven.map((chunk) => minutesBetween(chunk.start, chunk.end))).toEqual([70, 70, 70, 65, 65]);
  });

  it("uses fewer, longer chunks when that many don't fit, and returns null when none do", () => {
    const morning = mergeIntervals([iv("10:00", "14:00")]);
    // Three hours as 3 × 60 needs 4 hours with its breaks, from targets at 10:10, 11:30 and 12:50; 2 × 90 fits.
    expect(findEvenChunks(morning, 180, iv("00:00", "23:59"), split, 30)).toEqual([
      iv("10:15", "11:45"),
      iv("12:15", "13:45"),
    ]);
    expect(findEvenChunks(mergeIntervals([iv("10:00", "11:00")]), 180, iv("00:00", "23:59"), split, 30)).toBeNull();
  });
});

describe("findLatestSlot and findLatestChunks", () => {
  it("find the latest fit, ending on the grid, and cut chunks from the end", () => {
    const free = mergeIntervals([iv("10:00", "11:00"), iv("11:10", "12:00"), iv("13:00", "16:53")]);
    const day = iv("00:00", "23:59");

    expect(findLatestSlot(free, 60, day)).toEqual(iv("15:50", "16:50")); // rounded down to the grid
    expect(findLatestSlot(free, 60, iv("00:00", "12:30"))).toEqual(iv("10:00", "11:00")); // 11:10–12:00 too short
    expect(findLatestSlot(free, 5 * 60, day)).toBeNull();

    expect(findLatestChunks(free, 150, day, { minChunkMin: 30, maxChunkMin: 60 }, 30)).toEqual([
      iv("13:20", "13:50"),
      iv("14:20", "15:20"),
      iv("15:50", "16:50"),
    ]);
    // 60 and 10 would leave a chunk below the minimum, so the earlier one is the shorter.
    expect(findLatestChunks(free, 70, day, { minChunkMin: 30, maxChunkMin: 60 }, 30)).toEqual([
      iv("15:10", "15:40"),
      iv("16:10", "16:50"),
    ]);
  });
});

describe("chunk searches", () => {
  it("returns chunks inside free time and the window, on the grid, sized and spaced as asked, adding up to the duration", () => {
    const freeArb = intervalsArb.map(mergeIntervals);
    const breakArb = fc.integer({ min: 0, max: 90 });

    fc.assert(
      fc.property(
        freeArb,
        intervalArb(SPAN_MIN),
        taskMinutesArb(SLOT_MIN, 6 * 60),
        splitArb,
        breakArb,
        (free, window, durationMin, split, breakMin) => {
          const targets = evenTargets(free, window, durationMin, Math.ceil(durationMin / split.maxChunkMin));
          for (const [i, target] of targets.entries()) {
            expect(target >= window.start && target <= window.end).toBe(true);
            if (i > 0) expect(target >= targets[i - 1]).toBe(true);
          }

          const even = findEvenChunks(free, durationMin, window, split, breakMin);
          const searches = [
            findEarliestChunks(free, durationMin, window, split, breakMin),
            findLatestChunks(free, durationMin, window, split, breakMin),
            even,
          ];
          for (const chunks of searches) {
            if (chunks === null) continue;

            expect(chunks.reduce((sum, chunk) => sum + minutesBetween(chunk.start, chunk.end), 0)).toBe(durationMin);
            for (const [i, chunk] of chunks.entries()) {
              const length = minutesBetween(chunk.start, chunk.end);
              if (durationMin >= split.minChunkMin) expect(length).toBeGreaterThanOrEqual(split.minChunkMin);
              expect(length).toBeLessThanOrEqual(split.maxChunkMin);
              expect(minuteOf(chunk.start) % SLOT_MIN).toBe(0);
              expect(minuteOf(chunk.end) % SLOT_MIN).toBe(0);
              expect(subtractIntervals([chunk], free)).toEqual([]);
              expect(chunk.start >= window.start && chunk.end <= window.end).toBe(true);
              if (i > 0) expect(minutesBetween(chunks[i - 1].end, chunk.start)).toBeGreaterThanOrEqual(breakMin);
            }
          }
          if (even) {
            const lengths = even.map((chunk) => minutesBetween(chunk.start, chunk.end));
            expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(SLOT_MIN);
          }
        },
      ),
    );
  });
});
