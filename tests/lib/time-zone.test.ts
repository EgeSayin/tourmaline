import { describe, expect, it } from "vitest";
import { TIME_ZONES } from "@/lib/time-zone";

describe("TIME_ZONES", { tags: ["unit", "critical"] }, () => {
  it("contains only zones the runtime understands", () => {
    for (const zone of TIME_ZONES) {
      expect(() => Temporal.Now.zonedDateTimeISO(zone), zone).not.toThrow();
    }
  });
});
