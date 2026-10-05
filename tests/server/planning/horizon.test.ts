import { describe, expect, it } from "vitest";
import { planningHorizon } from "@/server/planning/horizon";
import { utc } from "../../support/intervals";
import { fixed, flexible } from "../../support/items";

describe("planningHorizon", { tags: ["unit", "critical"] }, () => {
  it("runs from now to the latest fixed item end or task deadline", () => {
    const now = new Date("2026-10-07T12:00Z");
    const essay = flexible("Essay", 60, utc("2026-10-01T00:00", "2026-10-21T15:00"));
    const trip = fixed("Trip", utc("2026-11-02T09:00", "2026-11-03T18:00"));
    const pastLecture = fixed("Lecture", utc("2026-10-05T14:00", "2026-10-05T15:00"));
    const overdue = flexible("Overdue", 60, utc("2026-10-01T00:00", "2026-10-06T00:00"));

    expect(planningHorizon(now, [essay, pastLecture])).toEqual({ start: now, end: essay.deadline });
    expect(planningHorizon(now, [essay, trip, overdue])).toEqual({ start: now, end: trip.end });
    expect(planningHorizon(now, [pastLecture, overdue])).toEqual({ start: now, end: now });
    expect(planningHorizon(now, [])).toEqual({ start: now, end: now });
  });
});
