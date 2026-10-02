import { describe, expect, it } from "vitest";
import { parseItemForm } from "@/server/items/parse-item-form";

const tz = "America/New_York";
const now = Temporal.Instant.from("2026-10-05T12:00Z"); // Mon Oct 5, 08:00 EDT

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
        durationMin: 120,
        earliestStart: new Date("2026-10-31T13:00Z"), // 09:00 EDT
        deadline: new Date("2026-11-02T22:00Z"), // 17:00 EST, after clocks go back
        split: { minChunkMin: 30, maxChunkMin: 60 },
        preferredWindows: [],
        spread: "even",
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
          durationMin: "0",
          earliestStart: "2026-10-05T09:00",
          deadline: "tomorrow",
          minChunkMin: "30",
        },
        tz,
        now,
      ),
    ).toMatchObject({
      ok: false,
      errors: { durationMin: [expect.any(String)], deadline: ["Enter a date and time"] },
    });

    const task = { timing: "flexible", title: "Essay", durationMin: "60" };
    for (const earliestStart of ["", "2026-10-04T09:00"]) {
      expect(parseItemForm({ ...task, earliestStart, deadline: "2026-10-05T07:00" }, tz, now)).toEqual({
        ok: false,
        errors: { deadline: ["Deadline must be in the future"] },
      });
    }
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
});
