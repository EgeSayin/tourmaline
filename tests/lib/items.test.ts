import { describe, expect, it } from "vitest";
import { isFixed, isTask, itemSpan, withSpan } from "@/lib/items";
import { utc } from "../support/intervals";
import { fixed, flexible } from "../support/items";

describe("item spans", { tags: ["unit"] }, () => {
  it("reads and moves when each kind of item can happen", () => {
    const lecture = fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:00"));
    const essay = flexible("Essay", 60, utc("2026-10-05T04:00", "2026-10-09T21:00"));
    const later = utc("2026-10-12T15:00", "2026-10-12T16:00");

    expect(itemSpan(lecture)).toEqual(utc("2026-10-05T15:00", "2026-10-05T16:00"));
    expect(itemSpan(essay)).toEqual(utc("2026-10-05T04:00", "2026-10-09T21:00"));
    expect(withSpan(lecture, later)).toEqual({ ...lecture, ...later });
    expect(withSpan(essay, later)).toEqual({ ...essay, earliestStart: later.start, deadline: later.end });
    expect([lecture, essay].filter(isFixed)).toEqual([lecture]);
    expect([lecture, essay].filter(isTask)).toEqual([essay]);
  });
});
