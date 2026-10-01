import { describe, expect, it } from "vitest";
import { TIME_ZONES, timeZoneOptions } from "@/lib/scheduler/time-zone";

function offsetMinutes(offset: string): number {
  const [hours, minutes] = offset.slice(1).split(":").map(Number);
  return (offset.startsWith("-") ? -1 : 1) * (hours * 60 + minutes);
}

describe("TIME_ZONES", () => {
  it("contains only zones the runtime understands", () => {
    for (const zone of TIME_ZONES) {
      expect(() => Temporal.Now.zonedDateTimeISO(zone), zone).not.toThrow();
    }
  });
});

describe("timeZoneOptions", () => {
  it("lists each zone once, sorted west to east by its offset at the given instant", () => {
    const january = timeZoneOptions(Temporal.Instant.from("2026-01-15T12:00Z"));
    const july = timeZoneOptions(Temporal.Instant.from("2026-07-15T12:00Z"));

    const values = january.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toHaveLength(new Set(TIME_ZONES).size);

    expect(january.at(0)).toEqual({ value: "Pacific/Honolulu", offset: "-10:00" });
    expect(january.at(-1)).toEqual({ value: "Pacific/Auckland", offset: "+13:00" });
    expect(january).toContainEqual({ value: "America/New_York", offset: "-05:00" });
    expect(july).toContainEqual({ value: "America/New_York", offset: "-04:00" });

    const expectedOrder = [...january].sort(
      (a, b) => offsetMinutes(a.offset) - offsetMinutes(b.offset) || a.value.localeCompare(b.value),
    );
    expect(january).toEqual(expectedOrder);
  });
});
