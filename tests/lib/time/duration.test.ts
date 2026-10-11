import { describe, expect, it } from "vitest";
import { parseDuration } from "@/lib/time/duration";

describe("parseDuration", () => {
  it("reads minutes, hours and both, in the ways people write them", () => {
    const cases: [string, number | null][] = [
      ["90", 90],
      ["45m", 45],
      ["45 min", 45],
      ["2h", 120],
      ["1.5h", 90],
      ["1h 30m", 90],
      ["1h30", 90],
      ["1 hour 15 minutes", 75],
      ["1:30", 90],
      [" 2H ", 120],
      ["", null],
      ["soon", null],
      ["1:75", null],
      ["30m 1h", null],
    ];
    for (const [text, minutes] of cases) expect(parseDuration(text), text).toBe(minutes);
  });
});
