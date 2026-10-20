import { describe, expect, it } from "vitest";
import type { Placement } from "@/lib/placements";
import { better, scorePlan } from "@/server/scheduler/objective";
import { planTask } from "@/server/scheduler/task-time";
import { utc } from "../../support/intervals";
import { flexible } from "../../support/items";

describe("plan goals", () => {
  it("rank leaving tasks out, then leaving preferred hours, then moving saved blocks, each by priority first", () => {
    const day = utc("2026-10-05T00:00", "2026-10-06T00:00");
    const block = (taskId: string, from: string, to: string): Placement => ({
      taskId,
      ...utc(`2026-10-05T${from}`, `2026-10-05T${to}`),
      pinned: false,
      status: "planned",
    });
    const morning = { startMinute: 9 * 60, endMinute: 12 * 60, must: false };
    const tasks = [
      flexible("Exam", 60, day, "mandatory"),
      { ...flexible("Reading", 60, day, "low"), timeOfDay: morning },
      { ...flexible("Notes", 60, day, "low"), timeOfDay: morning },
    ].map((task) => planTask(task));
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const saved = [block("Reading", "10:00", "11:00"), block("Exam", "13:00", "14:00")];
    const score = (placements: Placement[], unplaced: string[] = []) =>
      scorePlan({ placements, unplaced: unplaced.map((id) => tasksById.get(id)!), saved, tasks: tasksById });

    const ranked = [
      score([block("Notes", "09:00", "10:00"), ...saved]),
      score([block("Reading", "09:00", "10:00"), block("Notes", "10:00", "11:00"), saved[1]]), // moved the reading
      score([block("Notes", "09:00", "10:00"), saved[0], block("Exam", "14:00", "15:00")]), // moved the exam
      score([...saved, block("Notes", "15:00", "16:00")]), // notes outside the morning
      score(saved, ["Notes"]),
      score([saved[0]], ["Exam"]),
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
