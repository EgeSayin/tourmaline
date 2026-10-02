import { describe, expect, it } from "vitest";
import { weekContaining } from "@/server/week";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("weekContaining", { tags: ["unit", "critical"] }, () => {
  it("returns the local Monday-to-Monday week, including at its edges and across DST", () => {
    const tz = "America/New_York";

    // Thu Oct 8 2026, 11:00 EDT.
    const week = weekContaining(at("2026-10-08T15:00Z"), tz);
    expect(week.monday.toString()).toBe("2026-10-05");
    expect(week.range).toEqual({ start: new Date("2026-10-05T04:00Z"), end: new Date("2026-10-12T04:00Z") });

    // Mon 00:00 starts the new week; Sun 23:59 still belongs to the old one.
    expect(weekContaining(at("2026-10-12T04:00Z"), tz).monday.toString()).toBe("2026-10-12");
    expect(weekContaining(at("2026-10-12T03:59Z"), tz).monday.toString()).toBe("2026-10-05");

    // Clocks go back on Sun Nov 1, so this week starts in EDT and ends in EST: 169 hours.
    expect(weekContaining(at("2026-11-01T12:00Z"), tz).range).toEqual({
      start: new Date("2026-10-26T04:00Z"),
      end: new Date("2026-11-02T05:00Z"),
    });
  });
});
