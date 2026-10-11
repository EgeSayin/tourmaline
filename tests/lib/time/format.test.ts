import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/time/format";

describe("formatting", () => {
  it("shows an exact time with its local date, in 24-hour time", () => {
    expect(formatDateTime(new Date("2026-10-08T01:00Z"), "America/New_York")).toBe("Wed, Oct 7, 21:00");
    expect(formatDateTime(new Date("2026-10-08T04:05Z"), "America/New_York")).toBe("Thu, Oct 8, 00:05");
  });
});
