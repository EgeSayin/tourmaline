import { describe, expect, it } from "vitest";
import { NO_FOCUS_CAPS, type SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { focusDays } from "@/server/scheduler/focus-cap";
import { placeTasks } from "@/server/scheduler/placement";
import { utc } from "../../support/intervals";
import { fixed, flexible } from "../../support/items";

describe("focus caps", () => {
  it("counts each local day's busy time once against its weekday's cap", () => {
    // Mon Oct 5 to Wed Oct 7 in New York (UTC-4).
    const range = utc("2026-10-05T14:00", "2026-10-08T04:00");
    const lecture = utc("2026-10-05T14:00", "2026-10-05T17:00"); // Mon 10:00–13:00
    const overlapping = utc("2026-10-05T16:00", "2026-10-05T18:00"); // Mon 12:00–14:00
    const lateCall = utc("2026-10-07T03:00", "2026-10-07T05:00"); // Tue 23:00 to Wed 01:00
    const caps = [240, 240, null, ...NO_FOCUS_CAPS.slice(3)];

    expect(focusDays(range, [lecture, overlapping, lateCall], caps, "America/New_York")).toEqual([
      { ...utc("2026-10-05T04:00", "2026-10-06T04:00"), date: "2026-10-05", capMin: 240, usedMin: 240 },
      { ...utc("2026-10-06T04:00", "2026-10-07T04:00"), date: "2026-10-06", capMin: 240, usedMin: 60 },
      { ...utc("2026-10-07T04:00", "2026-10-08T04:00"), date: "2026-10-07", capMin: null, usedMin: 60 },
    ]);
  });

  it("keeps tasks under each day's cap where they fit before their deadline, and goes over only where they don't", () => {
    const settings: SchedulerSettings = {
      timeZone: "UTC",
      downtime: { startMinute: 22 * 60, endMinute: 10 * 60 },
      focusCaps: [240, 240, null, ...NO_FOCUS_CAPS.slice(3)], // 4h Monday and Tuesday, no cap Wednesday
    };
    const range = utc("2026-10-05T00:00", "2026-10-08T00:00");
    const lecture = fixed("Lecture", utc("2026-10-05T10:00", "2026-10-05T13:00")); // 3h of Monday's 4h
    const tasks = [
      flexible("Report", 120, utc("2026-10-05T13:00", "2026-10-05T18:00")), // only fits Monday
      flexible("Notes", 60, utc("2026-10-05T13:00", "2026-10-05T22:00")), // Monday is full by then
      flexible("Essay", 120, range),
      flexible("Lab", 300, utc("2026-10-06T00:00", "2026-10-08T00:00")), // more than Tuesday's 4h
    ];
    const days = focusDays(range, [lecture], settings.focusCaps, settings.timeZone);

    const { placements, unplaced } = placeTasks(tasks, freeTimeMap(range, [lecture], settings), [], days);

    expect(
      placements
        .map(({ taskId, start, end }) => ({ taskId, start, end }))
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    ).toEqual([
      { taskId: "Report", ...utc("2026-10-05T13:00", "2026-10-05T15:00") }, // over the cap, to meet its deadline
      { taskId: "Notes", ...utc("2026-10-05T15:00", "2026-10-05T16:00") },
      { taskId: "Essay", ...utc("2026-10-06T10:00", "2026-10-06T12:00") },
      { taskId: "Lab", ...utc("2026-10-07T10:00", "2026-10-07T15:00") },
    ]);
    expect(unplaced).toEqual([]);
  });
});
