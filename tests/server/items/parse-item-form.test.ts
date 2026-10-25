import { describe, expect, it } from "vitest";
import { itemToFormValues } from "@/lib/item-form";
import type { Recurrence } from "@/lib/recurrence";
import { DEFAULT_CHUNK_BREAK_MIN, DEFAULT_MAX_CHUNK_MIN, DEFAULT_MIN_CHUNK_MIN } from "@/lib/settings";
import { parseItemForm } from "@/server/items/parse-item-form";
import { fixed, flexible } from "../../support/items";

const tz = "America/New_York";
const now = new Date("2026-10-05T12:00Z"); // Mon Oct 5, 08:00 EDT

describe("parseItemForm", () => {
  it("turns valid form fields into items, converting local times in the user's time zone", () => {
    expect(
      parseItemForm(
        {
          timing: "fixed",
          title: "  CS 101 lecture ",
          date: "2026-10-05",
          startTime: "11:00",
          endTime: "12:15",
          location: "",
          bufferBeforeMin: "15",
          bufferAfterMin: "",
        },
        tz,
        now,
      ),
    ).toEqual({
      ok: true,
      item: {
        title: "CS 101 lecture",
        priority: "normal",
        timing: "fixed",
        recurrence: null,
        categoryId: null,
        start: new Date("2026-10-05T15:00Z"), // 11:00 EDT
        end: new Date("2026-10-05T16:15Z"),
        dayTimes: null,
        location: null,
        bufferBeforeMin: 15,
        bufferAfterMin: 0,
      },
    });
    // Ending at an earlier time means ending the next day.
    expect(
      parseItemForm(
        { timing: "fixed", title: "Shift", date: "2026-10-05", startTime: "22:00", endTime: "02:30" },
        tz,
        now,
      ),
    ).toMatchObject({ item: { start: new Date("2026-10-06T02:00Z"), end: new Date("2026-10-06T06:30Z") } });

    expect(
      parseItemForm(
        {
          timing: "flexible",
          title: "Essay",
          priority: "high",
          durationMin: "120",
          earliestStart: "2026-10-31T09:00",
          deadline: "2026-11-02T17:00",
          blocks: "split",
          minChunkMin: "30",
          maxChunkMin: "60",
          spread: "just-in-time",
        },
        tz,
        now,
      ),
    ).toEqual({
      ok: true,
      item: {
        title: "Essay",
        priority: "high",
        timing: "flexible",
        recurrence: null,
        categoryId: null,
        durationMin: 120,
        dayDurations: null,
        earliestStart: new Date("2026-10-31T13:00Z"), // 09:00 EDT
        deadline: new Date("2026-11-02T22:00Z"), // 17:00 EST, after clocks go back
        split: { minChunkMin: 30, maxChunkMin: 60, breakMin: 30 },
        spread: "just-in-time",
        withinPeriod: false,
        upTo: false,
        totalMin: null,
        timeOfDay: null,
      },
    });
  });

  it("reports field errors for invalid input", () => {
    expect(
      parseItemForm({ timing: "fixed", title: " ", date: "2026-10-05", startTime: "12:00", endTime: "12:00" }, tz, now),
    ).toEqual({
      ok: false,
      errors: { title: ["Enter a title"], endTime: ["End must differ from start"] },
    });
    expect(parseItemForm({ timing: "fixed", title: "Party" }, tz, now)).toMatchObject({
      errors: { date: ["Enter a date"], startTime: ["Enter a time"], endTime: ["Enter a time"] },
    });

    expect(
      parseItemForm(
        {
          timing: "flexible",
          title: "Essay",
          durationMin: "1h 30m",
          earliestStart: "2026-10-05T09:00",
          deadline: "tomorrow",
          minChunkMin: "30",
        },
        tz,
        now,
      ),
    ).toMatchObject({
      ok: false,
      errors: { durationMin: ["Enter a duration"], deadline: ["Enter a date and time"] },
    });

    const task = { timing: "flexible", title: "Essay", durationMin: "60" };
    const dueTomorrow = { ...task, deadline: "2026-10-06T17:00" };
    expect(parseItemForm({ ...dueTomorrow, minChunkMin: "42", maxChunkMin: "60" }, tz, now)).toEqual({
      ok: false,
      errors: { minChunkMin: ["Use multiples of 5 minutes"] },
    });
    expect(parseItemForm({ ...dueTomorrow, minChunkMin: "45", maxChunkMin: "30" }, tz, now)).toEqual({
      ok: false,
      errors: { maxChunkMin: ["Longest block must be at least the shortest"] },
    });
    // A length left empty takes its default, which the other must still fit.
    for (const lengths of [{ maxChunkMin: "20" }, { minChunkMin: "180" }]) {
      expect(parseItemForm({ ...dueTomorrow, blocks: "split", ...lengths }, tz, now)).toEqual({
        ok: false,
        errors: { maxChunkMin: ["Longest block must be at least the shortest"] },
      });
    }
    expect(parseItemForm({ ...dueTomorrow, blocks: "split" }, tz, now)).toMatchObject({
      ok: true,
      item: {
        split: {
          minChunkMin: DEFAULT_MIN_CHUNK_MIN,
          maxChunkMin: DEFAULT_MAX_CHUNK_MIN,
          breakMin: DEFAULT_CHUNK_BREAK_MIN,
        },
      },
    });
    // Its own least time between blocks, which may be none.
    for (const breakMin of [0, 120]) {
      expect(parseItemForm({ ...dueTomorrow, blocks: "split", breakMin: String(breakMin) }, tz, now)).toMatchObject({
        ok: true,
        item: { split: { breakMin } },
      });
    }
    expect(parseItemForm({ ...dueTomorrow, blocks: "split", breakMin: "7" }, tz, now)).toEqual({
      ok: false,
      errors: { breakMin: ["Use multiples of 5 minutes"] },
    });

    for (const earliestStart of ["", "2026-10-04T09:00"]) {
      expect(parseItemForm({ ...task, earliestStart, deadline: "2026-10-05T07:00" }, tz, now)).toEqual({
        ok: false,
        errors: { deadline: ["Deadline must be in the future"] },
      });
    }
    expect(
      parseItemForm({ ...task, earliestStart: "2026-10-09T09:00", deadline: "2026-10-08T17:00" }, tz, now),
    ).toEqual({ ok: false, errors: { deadline: ["Deadline must be after the earliest start"] } });
  });

  it("starts flexible tasks now when no earliest start is given", () => {
    const task = {
      timing: "flexible",
      title: "Essay",
      durationMin: "60",
      earliestStart: "",
      deadline: "2026-10-06T17:00",
    };
    expect(parseItemForm(task, tz, now)).toMatchObject({
      ok: true,
      item: { earliestStart: new Date("2026-10-05T12:00Z"), deadline: new Date("2026-10-06T21:00Z") },
    });

    // A repeating one starts at the start of today instead, so its occurrences run from midnight to midnight: daily
    // from Mon Oct 5, or on its first day from then, Wed Oct 7, with that day's own duration.
    const daily = { ...task, deadline: "", repeat: "daily" };
    expect(parseItemForm(daily, tz, now)).toMatchObject({
      ok: true,
      item: { earliestStart: new Date("2026-10-05T04:00Z"), deadline: new Date("2026-10-06T04:00Z") },
    });
    const weekly = {
      ...daily,
      repeat: "weekly",
      weekdays: "3,5",
      perDay: "each",
      "durationMin-3": "45",
      "durationMin-5": "90",
    };
    expect(parseItemForm(weekly, tz, now)).toMatchObject({
      ok: true,
      item: { durationMin: 45, earliestStart: new Date("2026-10-05T04:00Z"), deadline: new Date("2026-10-09T04:00Z") },
    });
  });

  it("parses repeat rules, making each recurring task due when its next occurrence starts", () => {
    const lecture = {
      timing: "fixed",
      title: "Lecture",
      date: "2026-10-05",
      startTime: "11:00",
      endTime: "12:15",
      repeat: "weekly",
      interval: "2",
      weekdays: "3,1,3", // sorted, without the duplicate
      until: "2026-12-11",
    };
    expect(parseItemForm(lecture, tz, now)).toMatchObject({
      ok: true,
      item: { recurrence: { frequency: "weekly", interval: 2, weekdays: [1, 3], until: "2026-12-11" } },
    });

    // Daily from Sat Oct 31 10:00 EDT: due at 10:00 EST the next day, after clocks go back.
    const gym = {
      timing: "flexible",
      title: "Gym",
      durationMin: "60",
      earliestStart: "2026-10-31T10:00",
      repeat: "daily",
    };
    expect(parseItemForm(gym, tz, now)).toMatchObject({
      ok: true,
      item: {
        recurrence: { frequency: "daily", interval: 1, until: null },
        earliestStart: new Date("2026-10-31T14:00Z"),
        deadline: new Date("2026-11-01T15:00Z"),
      },
    });
    // Mondays and Fridays from Wed Sep 23: first on Fri Sep 25, so due Mon Sep 28, which may be in the past.
    expect(
      parseItemForm({ ...gym, earliestStart: "2026-09-23T10:00", repeat: "weekly", weekdays: "1,5" }, tz, now),
    ).toMatchObject({ ok: true, item: { deadline: new Date("2026-09-28T14:00Z") } });

    // Kept within its day: due at midnight instead, and only a repeating task can be.
    expect(parseItemForm({ ...gym, catchUp: "in-period" }, tz, now)).toMatchObject({
      ok: true,
      item: { withinPeriod: true, deadline: new Date("2026-11-01T04:00Z") },
    });
    expect(
      parseItemForm({ ...gym, repeat: "none", deadline: "2026-11-02T18:00", catchUp: "in-period" }, tz, now),
    ).toMatchObject({ ok: true, item: { withinPeriod: false } });

    // Taking only what fits keeps it within its day whatever the catch-up choice, and it may stop after a total; a
    // one-off task does neither.
    expect(parseItemForm({ ...gym, amount: "fits", catchUp: "later", totalMin: "600" }, tz, now)).toMatchObject({
      ok: true,
      item: { upTo: true, withinPeriod: true, totalMin: 600, deadline: new Date("2026-11-01T04:00Z") },
    });
    expect(
      parseItemForm({ ...gym, repeat: "none", deadline: "2026-11-02T18:00", amount: "fits", totalMin: "600" }, tz, now),
    ).toMatchObject({ ok: true, item: { upTo: false, withinPeriod: false, totalMin: null } });
  });

  it("parses times and durations per day only for a weekly item on more than one day, each day's errors apart", () => {
    const lecture = {
      timing: "fixed",
      title: "Lecture",
      date: "2026-10-08", // Thu
      repeat: "weekly",
      weekdays: "2,4",
      perDay: "each",
      "startTime-2": "13:00",
      "endTime-2": "14:00",
      "startTime-4": "14:00",
      "endTime-4": "15:00",
    };
    const dayTimes = {
      2: { startMinute: 13 * 60, endMinute: 14 * 60 },
      4: { startMinute: 14 * 60, endMinute: 15 * 60 },
    };
    // Its own times are its first date's, or its first day's when that date isn't one of its days.
    expect(parseItemForm(lecture, tz, now)).toMatchObject({
      ok: true,
      item: { dayTimes, start: new Date("2026-10-08T18:00Z"), end: new Date("2026-10-08T19:00Z") },
    });
    expect(parseItemForm({ ...lecture, date: "2026-10-07" }, tz, now)).toMatchObject({
      ok: true,
      item: { dayTimes, start: new Date("2026-10-07T17:00Z"), end: new Date("2026-10-07T18:00Z") },
    });
    // On one day only, its times are the item's own.
    expect(parseItemForm({ ...lecture, weekdays: "2", startTime: "09:00", endTime: "10:00" }, tz, now)).toMatchObject({
      ok: true,
      item: { dayTimes: null, start: new Date("2026-10-08T13:00Z") },
    });
    expect(parseItemForm({ ...lecture, title: "", "startTime-4": "", "endTime-2": "13:00" }, tz, now)).toEqual({
      ok: false,
      errors: {
        title: [expect.any(String)],
        "endTime-2": ["End must differ from start"],
        "startTime-4": ["Enter a time"],
      },
    });

    const reading = {
      timing: "flexible",
      title: "Reading",
      earliestStart: "2026-10-08T09:00",
      repeat: "weekly",
      weekdays: "2,4",
      perDay: "each",
      "durationMin-2": "60",
      "durationMin-4": "120",
    };
    expect(parseItemForm(reading, tz, now)).toMatchObject({
      ok: true,
      item: { durationMin: 120, dayDurations: { 2: 60, 4: 120 } },
    });
    expect(parseItemForm({ ...reading, "durationMin-2": "" }, tz, now)).toEqual({
      ok: false,
      errors: { "durationMin-2": ["Enter a duration"] },
    });
    // Each day's blocks must fit the hours it must keep to.
    expect(
      parseItemForm(
        {
          ...reading,
          earliestStart: "2026-10-06T09:00",
          timeOfDayStart: "540",
          timeOfDayEnd: "600",
          timeOfDayRule: "must",
        },
        tz,
        now,
      ),
    ).toEqual({ ok: false, errors: { timeOfDay: ["Its blocks are longer than these hours"] } });
  });

  it("reports invalid repeat rules", () => {
    const lecture = { timing: "fixed", title: "Lecture", date: "2026-10-05", startTime: "11:00", endTime: "12:15" };
    expect(parseItemForm({ ...lecture, repeat: "weekly", weekdays: "", interval: "0" }, tz, now)).toEqual({
      ok: false,
      errors: { interval: [expect.any(String)], weekdays: ["Choose at least one day"] },
    });
    expect(parseItemForm({ ...lecture, repeat: "weekly", weekdays: "8" }, tz, now)).toMatchObject({
      ok: false,
      errors: { weekdays: [expect.any(String)] },
    });
    // Only Fridays, ending on Thursday.
    expect(parseItemForm({ ...lecture, repeat: "weekly", weekdays: "5", until: "2026-10-08" }, tz, now)).toEqual({
      ok: false,
      errors: { until: ["The series ends before it first occurs"] },
    });

    // Missing fields are all reported at once, whichever check finds them.
    expect(
      parseItemForm({ timing: "flexible", title: "", repeat: "weekly", minChunkMin: "30" }, tz, now),
    ).toMatchObject({
      ok: false,
      errors: {
        title: [expect.any(String)],
        durationMin: [expect.any(String)],
        weekdays: [expect.any(String)],
      },
    });
    expect(parseItemForm({ timing: "flexible", title: "" }, tz, now)).toMatchObject({
      ok: false,
      errors: { deadline: ["Enter a date and time"] },
    });

    const task = { timing: "flexible", title: "Gym", durationMin: "60" };
    expect(parseItemForm(task, tz, now)).toEqual({ ok: false, errors: { deadline: ["Enter a date and time"] } });
  });

  it("parses a task's time of day, and rejects hours it must keep to but can't fit in", () => {
    const task = {
      timing: "flexible",
      title: "Gym",
      durationMin: "90",
      deadline: "2026-10-07T23:00", // Wednesday
      timeOfDayStart: String(18 * 60),
      timeOfDayEnd: String(20 * 60),
    };
    const parse = (fields: Record<string, string>) => parseItemForm({ ...task, ...fields }, tz, now);

    expect(parse({})).toMatchObject({
      ok: true,
      item: { timeOfDay: { startMinute: 1080, endMinute: 1200, must: false } },
    });
    expect(parse({ timeOfDayRule: "must" })).toMatchObject({ ok: true, item: { timeOfDay: { must: true } } });
    expect(parse({ timeOfDayStart: "", timeOfDayEnd: "" })).toMatchObject({ ok: true, item: { timeOfDay: null } });

    const errors = (fields: Record<string, string>) => {
      const parsed = parse(fields);
      return parsed.ok ? null : parsed.errors.timeOfDay;
    };
    expect(errors({ timeOfDayEnd: String(18 * 60) })).toEqual(["Choose hours that end after they start"]);
    // Must: a 90-minute block can't fit in an hour; preferred hours may be shorter than the task.
    expect(errors({ timeOfDayEnd: String(19 * 60), timeOfDayRule: "must" })).toEqual([
      "Its blocks are longer than these hours",
    ]);
    expect(errors({ timeOfDayEnd: String(19 * 60) })).toBeNull();
    // Due Monday 19:00, it has an hour of its evening left.
    expect(errors({ deadline: "2026-10-05T19:00", timeOfDayRule: "must" })).toEqual([
      "It can't fit in these hours before it's due",
    ]);
  });

  it("parses an item's own form values, category included, back into the same item", () => {
    const lecture = {
      ...fixed("Lecture", { start: new Date("2026-10-05T15:00Z"), end: new Date("2026-10-05T16:15Z") }, 15, 5),
      location: "Hall 1",
      categoryId: "5b1f3d0e-8a4c-4f6e-9d2b-7c3a1e5f9b80",
    };
    const essay = {
      ...flexible("Essay", 120, { start: new Date("2026-10-31T13:00Z"), end: new Date("2026-11-02T22:00Z") }, "high"),
      split: { minChunkMin: 30, maxChunkMin: 60, breakMin: 30 },
      spread: "even" as const,
      timeOfDay: { startMinute: 18 * 60, endMinute: 22 * 60, must: false },
    };

    const weeklyLecture = {
      ...lecture,
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 3], until: "2026-12-11" } satisfies Recurrence,
    };
    const dailyGym = {
      ...flexible("Gym", 60, { start: new Date("2026-10-05T14:00Z"), end: new Date("2026-10-06T14:00Z") }),
      recurrence: { frequency: "daily", interval: 1, until: null } satisfies Recurrence,
      timeOfDay: { startMinute: 7 * 60, endMinute: 9 * 60 + 30, must: true },
    };

    const weeklyProject = {
      ...flexible("Game", 6 * 60, { start: new Date("2026-10-05T04:00Z"), end: new Date("2026-10-12T04:00Z") }),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null } satisfies Recurrence,
      split: { minChunkMin: 120, maxChunkMin: 120, breakMin: 30 },
      spread: "even" as const,
      withinPeriod: true,
      upTo: true,
      totalMin: 300 * 60,
    };

    const lectureByDay = {
      ...weeklyLecture,
      dayTimes: {
        1: { startMinute: 11 * 60, endMinute: 12 * 60 + 15 },
        3: { startMinute: 13 * 60, endMinute: 14 * 60 },
      },
    };
    const readingByDay = {
      ...flexible("Reading", 60, { start: new Date("2026-10-06T13:00Z"), end: new Date("2026-10-08T13:00Z") }),
      recurrence: { frequency: "weekly", interval: 1, weekdays: [2, 4], until: null } satisfies Recurrence,
      dayDurations: { 2: 60, 4: 120 },
    };

    const dailyLunch = {
      ...flexible("Lunch", 45, { start: new Date("2026-10-05T15:30Z"), end: new Date("2026-10-06T04:00Z") }),
      recurrence: { frequency: "daily", interval: 1, until: null } satisfies Recurrence,
      withinPeriod: true,
    };

    // The form leaves out what's stored apart from the item's own fields: its id, occurrence states and changes, and
    // whether it's done.
    for (const { id, occurrences, changes, ...item } of [
      lecture,
      essay,
      weeklyLecture,
      dailyGym,
      dailyLunch,
      weeklyProject,
      lectureByDay,
      readingByDay,
    ]) {
      const parsed = parseItemForm(itemToFormValues({ id, occurrences, changes, ...item }, tz), tz, now);
      const { done: _, ...fields } = { done: false, ...item };
      expect(parsed.ok && parsed.item).toEqual(fields);
    }

    const unknownCategory = parseItemForm({ ...itemToFormValues(lecture, tz), category: "csc" }, tz, now);
    expect(unknownCategory).toEqual({ ok: false, errors: { category: ["Pick a category"] } });
  });
});
