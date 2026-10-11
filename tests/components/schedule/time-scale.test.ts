import { describe, expect, it } from "vitest";
import type { CalendarBlock } from "@/lib/calendar-blocks";
import { timeScaleFor } from "@/components/schedule/time-scale";

const block = (startMinute: number, endMinute: number) => ({ startMinute, endMinute }) as CalendarBlock;

describe("timeScaleFor", () => {
  it("spans the whole hours around the blocks, or a default day when there are none", () => {
    const scale = timeScaleFor([block(9 * 60 + 30, 10 * 60), block(13 * 60, 14 * 60 + 15)]);
    expect(scale.hours).toEqual([9, 10, 11, 12, 13, 14]);
    expect(scale.top(9 * 60)).toBe(0);
    expect(scale.top(10 * 60)).toBe(scale.height / 6);

    const empty = timeScaleFor([]);
    expect(empty.hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(empty.height).toBeGreaterThan(0);
  });
});
