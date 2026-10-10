import { describe, expect, it } from "vitest";
import { itemToFormValues } from "@/lib/item-form";
import type { Recurrence } from "@/lib/recurrence";
import { parseItemForm } from "@/server/items/parse-item-form";
import { fixed, flexible } from "../../support/items";

const tz = "America/New_York";
const now = new Date("2026-10-05T12:00Z"); // Mon Oct 5, 08:00 EDT

describe("parseItemForm", { tags: ["unit", "critical"] }, () => {
  it("turns valid form fields into items, converting local times in the user's time zone", () => {
    expect(
      parseItemForm(
        {
          timing: "fixed",
          title: "  CS 101 lecture ",
          start: "2026-10-05T11:00",
          end: "2026-10-05T12:15",
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
        start: new Date("2026-10-05T15:00Z"), // 11:00 EDT
        end: new Date("2026-10-05T16:15Z"),
        location: null,
        bufferBeforeMin: 15,
        bufferAfterMin: 0,
      },
    });

    expect(
      parseItemForm(
        {
          timing: "flexible",
          title: "Essay",
          priority: "high",
          durationMin: "120",
          earliestStart: "2026-10-31T09:00",
          deadline: "2026-11-02T17:00",
          minChunkMin: "30",
          maxChunkMin: "60",
          preferredFrom: "18:00",
          preferredUntil: "21:30",
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
        durationMin: 120,
        earliestStart: new Date("2026-10-31T13:00Z"), // 09:00 EDT
        deadline: new Date("2026-11-02T22:00Z"), // 17:00 EST, after clocks go back
        split: { minChunkMin: 30, maxChunkMin: 60 },
        preferredWindows: [{ startMinute: 18 * 60, endMinute: 21 * 60 + 30 }],
        spread: "asap",
      },
    });
  });

  it("reports field errors for invalid input", () => {
    expect(
      parseItemForm({ timing: "fixed", title: " ", start: "2026-10-05T12:00", end: "2026-10-05T11:00" }, tz, now),
    ).toEqual({
      ok: false,
      errors: { title: ["Enter a title"], end: ["End must be after start"] },
    });

    expect(
      parseItemForm(
        {
          timing: "flexible",
          title: "Essay",
          durationMin: "42",
          earliestStart: "2026-10-05T09:00",
          deadline: "tomorrow",
          minChunkMin: "30",
        },
        tz,
        now,
      ),
    ).toMatchObject({
      ok: false,
      errors: { durationMin: ["Use multiples of 5 minutes"], deadline: ["Enter a date and time"] },
    });

    const task = { timing: "flexible", title: "Essay", durationMin: "60" };
    const dueTomorrow = { ...task, deadline: "2026-10-06T17:00" };
    expect(parseItemForm({ ...dueTomorrow, preferredFrom: "12:00" }, tz, now)).toEqual({
      ok: false,
      errors: { preferredUntil: ["Set both times or neither"] },
    });
    expect(parseItemForm({ ...dueTomorrow, preferredFrom: "12:00", preferredUntil: "12:00" }, tz, now)).toEqual({
      ok: false,
      errors: { preferredUntil: ["Use a different time than the start"] },
    });
    expect(parseItemForm({ ...dueTomorrow, preferredFrom: "25:00", preferredUntil: "noon" }, tz, now)).toEqual({
      ok: false,
      errors: { preferredFrom: ["Enter a time"], preferredUntil: ["Enter a time"] },
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
  });

  it("parses repeat rules, making each recurring task due when its next occurrence starts", () => {
    const lecture = {
      timing: "fixed",
      title: "Lecture",
      start: "2026-10-05T11:00",
      end: "2026-10-05T12:15",
      repeat: "weekly",
      interval: "2",
      weekdays: "3,1",
      until: "2026-12-11",
    };
    expect(parseItemForm(lecture, tz, now)).toMatchObject({
      ok: true,
      item: { recurrence: { frequency: "weekly", interval: 2, weekdays: [3, 1], until: "2026-12-11" } },
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
  });

  it("reports invalid repeat rules", () => {
    const lecture = { timing: "fixed", title: "Lecture", start: "2026-10-05T11:00", end: "2026-10-05T12:15" };
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
      parseItemForm({ timing: "flexible", title: "", repeat: "weekly", preferredFrom: "12:00" }, tz, now),
    ).toMatchObject({
      ok: false,
      errors: {
        title: [expect.any(String)],
        preferredUntil: ["Set both times or neither"],
        durationMin: [expect.any(String)],
        earliestStart: [expect.any(String)],
        weekdays: [expect.any(String)],
      },
    });
    expect(parseItemForm({ timing: "flexible", title: "" }, tz, now)).toMatchObject({
      ok: false,
      errors: { deadline: ["Enter a date and time"] },
    });

    const task = { timing: "flexible", title: "Gym", durationMin: "60" };
    expect(parseItemForm({ ...task, repeat: "daily" }, tz, now)).toEqual({
      ok: false,
      errors: { earliestStart: ["Enter when each occurrence can start"] },
    });
    expect(parseItemForm(task, tz, now)).toEqual({ ok: false, errors: { deadline: ["Enter a date and time"] } });
  });

  it("parses an item's own form values back into the same item", () => {
    const lecture = {
      ...fixed("Lecture", { start: new Date("2026-10-05T15:00Z"), end: new Date("2026-10-05T16:15Z") }, 15, 5),
      location: "Hall 1",
    };
    const essay = {
      ...flexible("Essay", 120, { start: new Date("2026-10-31T13:00Z"), end: new Date("2026-11-02T22:00Z") }, "high"),
      split: { minChunkMin: 30, maxChunkMin: 60 },
      preferredWindows: [{ startMinute: 22 * 60 + 5, endMinute: 60 }], // wraps past midnight
    };

    const weeklyLecture = {
      ...lecture,
      recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 3], until: "2026-12-11" } satisfies Recurrence,
    };
    const dailyGym = {
      ...flexible("Gym", 60, { start: new Date("2026-10-05T14:00Z"), end: new Date("2026-10-06T14:00Z") }),
      recurrence: { frequency: "daily", interval: 1, until: null } satisfies Recurrence,
    };

    for (const item of [lecture, essay, weeklyLecture, dailyGym]) {
      const parsed = parseItemForm(itemToFormValues(item, tz), tz, now);
      expect(parsed.ok && { id: item.id, overrides: item.overrides, ...parsed.item }).toEqual(item);
    }
  });
});
