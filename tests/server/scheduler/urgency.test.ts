import { describe, expect, it } from "vitest";
import type { Priority } from "@/lib/items";
import type { Interval } from "@/server/scheduler/intervals";
import { orderByUrgency, pressure } from "@/server/scheduler/urgency";
import { flexible } from "../../support/items";

const oct = (day: number, hour = 0) => new Date(Date.UTC(2026, 9, day, hour));

const task = (title: string, durationMin: number, deadline: Date, priority?: Priority) =>
  flexible(title, durationMin, { start: oct(5), end: deadline }, priority);

describe("orderByUrgency", { tags: ["unit", "critical"] }, () => {
  it("orders by priority, then pressure, then deadline", () => {
    // Mon Oct 5 – Fri Oct 9, free 10:00–16:00 each day: 6 hours per day.
    const free: Interval[] = [5, 6, 7, 8, 9].map((day) => ({ start: oct(day, 10), end: oct(day, 16) }));

    const homework = task("Homework", 60, oct(8)); // 1h of 18h available
    const project = task("Project", 10 * 60, oct(10)); // 10h of 30h: bigger and due later, but more pressing
    const problemSet = task("Problem set", 90, oct(8)); // 1.5h of 18h
    const worksheet = task("Worksheet", 2 * 60, oct(9)); // 2h of 24h: same pressure, later deadline
    const overdue = task("Overdue", 2 * 60, oct(5, 8)); // no free time before the deadline
    const reading = task("Reading", 60, oct(10), "mandatory"); // low pressure, top priority
    const sideProject = task("Side project", 20 * 60, oct(10), "low"); // high pressure, lowest priority

    expect(pressure(homework, free)).toBeCloseTo(1 / 18);
    expect(pressure(project, free)).toBeCloseTo(1 / 3);
    expect(pressure(overdue, free)).toBe(Infinity);

    const tasks = [homework, sideProject, worksheet, project, reading, overdue, problemSet];
    expect(orderByUrgency(tasks, free).map((t) => t.title)).toEqual([
      "Reading",
      "Overdue",
      "Project",
      "Problem set",
      "Worksheet",
      "Homework",
      "Side project",
    ]);
  });
});
