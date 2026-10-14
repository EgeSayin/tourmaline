import { describe, expect, it } from "vitest";
import type { Placement } from "@/lib/placements";
import { mergeIntervals } from "@/lib/time/interval";
import { better, scorePlan } from "@/server/scheduler/objective";
import { utc } from "../../support/intervals";
import { flexible } from "../../support/items";

describe("plan goals", () => {
  it("rank unplaced tasks by priority first, then saved blocks moved", () => {
    const day = utc("2026-10-05T00:00", "2026-10-06T00:00");
    const block = (taskId: string, from: string, to: string): Placement => ({
      taskId,
      ...utc(`2026-10-05T${from}`, `2026-10-05T${to}`),
      pinned: false,
      status: "planned",
    });
    const saved = [block("Reading", "10:00", "11:00")];
    const score = (placements: Placement[], unplaced: string[]) =>
      scorePlan({
        placements,
        unplaced: unplaced.map((title) => flexible(title, 60, day, title === "Exam" ? "mandatory" : "low")),
        saved,
        optionalTime: mergeIntervals([]),
      });

    const ranked = [
      score([block("Reading", "10:00", "11:00"), block("Exam", "11:00", "12:00")], []),
      score([block("Reading", "12:00", "13:00"), block("Exam", "10:00", "11:00")], []), // moved a block
      score([block("Exam", "10:00", "11:00")], ["Reading", "Notes", "Chat"]), // only low tasks left out
      score([block("Reading", "10:00", "11:00")], ["Exam"]),
    ];
    for (const [i, plan] of ranked.entries()) {
      for (const worse of ranked.slice(i + 1)) {
        expect(better(plan, worse)).toBe(true);
        expect(better(worse, plan)).toBe(false);
      }
    }
    expect(better(ranked[0], [...ranked[0]])).toBe(false); // a tie keeps the plan tried first
  });
});
