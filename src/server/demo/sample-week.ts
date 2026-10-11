import "server-only";
import type { NewCategory } from "@/lib/categories";
import type { FixedItem, Task, Priority } from "@/lib/items";
import type { Recurrence, Weekday } from "@/lib/recurrence";
import { DEFAULT_SETTINGS, type SchedulerSettings } from "@/lib/settings";
import { withFirstDeadline } from "@/server/recurrence";
import { weekContaining } from "@/server/time/days";
import { toDate } from "@/server/time/temporal";

const settings: SchedulerSettings = { ...DEFAULT_SETTINGS, timeZone: "America/New_York" };

function local(date: string, time: string): Date {
  return toDate(Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(settings.timeZone));
}

function fixed(
  id: string,
  title: string,
  date: string,
  [from, to]: [string, string],
  options: Partial<
    Pick<
      FixedItem,
      "priority" | "recurrence" | "overrides" | "location" | "bufferBeforeMin" | "bufferAfterMin" | "categoryId"
    >
  > = {},
): FixedItem {
  return {
    id,
    title,
    timing: "fixed",
    start: local(date, from),
    end: local(date, to),
    priority: "mandatory",
    recurrence: null,
    overrides: [],
    categoryId: null,
    location: null,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    bumped: false,
    ...options,
  };
}

function flexible(
  id: string,
  title: string,
  durationMin: number,
  [earliestStart, deadline]: [Date, Date],
  priority: Priority = "normal",
): Task {
  return {
    id,
    title,
    timing: "flexible",
    priority,
    recurrence: null,
    overrides: [],
    categoryId: null,
    durationMin,
    earliestStart,
    deadline,
    split: null,
    spread: "asap",
    done: false,
  };
}

function recurringTask(
  id: string,
  title: string,
  durationMin: number,
  earliestStart: Date,
  recurrence: Recurrence,
  priority: Priority = "normal",
): Task {
  const { deadline: _, ...task } = flexible(id, title, durationMin, [earliestStart, earliestStart], priority);
  return withFirstDeadline<Task>({ ...task, recurrence }, settings.timeZone)!;
}

/** Keyed by the `categoryId` the sample items use until the seed saves them. */
const categories: Record<string, NewCategory> = {
  cs: { name: "CS 101", color: "blue" },
  calc: { name: "Calculus", color: "orange" },
  seminar: { name: "Seminar", color: "purple" },
  health: { name: "Health", color: "green" },
};

const lectureBuffers = { location: "Science Hall 101", bufferBeforeMin: 15, bufferAfterMin: 15 };
const weekly = (...weekdays: Weekday[]): Recurrence => ({ frequency: "weekly", interval: 1, weekdays, until: null });
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };

/**
 * A student's week of fixed items and tasks, in the week (Monday–Sunday) containing `now`, and the categories they
 * belong to. Lectures, chess club, lunch, gym and language practice repeat from that week on. Next Wednesday, a guest
 * talk has bumped chess club.
 */
export function sampleWeek(now: Date) {
  const week = weekContaining(now, settings.timeZone).dates;
  const [MON, TUE, WED, THU, FRI, SAT, SUN] = week;
  const NEXT_WED = Temporal.PlainDate.from(WED).add({ days: 7 }).toString();

  const fixedItems: FixedItem[] = [
    fixed("cs", "CS 101 lecture", MON, ["11:00", "12:15"], {
      ...lectureBuffers,
      recurrence: weekly(1, 3, 5),
      categoryId: "cs",
    }),
    fixed("calc", "Calculus lecture", TUE, ["14:00", "15:30"], {
      ...lectureBuffers,
      recurrence: weekly(2, 4),
      categoryId: "calc",
    }),
    fixed("chess", "Chess club", WED, ["18:00", "19:30"], {
      priority: "normal",
      recurrence: weekly(3),
      overrides: [{ date: NEXT_WED, skipped: false, done: false, bumped: true }],
    }),
    fixed("talk", "Guest talk", NEXT_WED, ["17:30", "19:00"], { location: "Main auditorium", categoryId: "seminar" }),
    fixed("hangout", "Dinner with friends", SAT, ["19:00", "22:00"], { priority: "normal" }),
  ];

  const tasks: Task[] = [
    recurringTask("lunch", "Lunch", 45, local(MON, "11:30"), daily, "mandatory"),
    { ...recurringTask("gym", "Gym", 60, local(TUE, "17:00"), weekly(2, 4, 6), "high"), categoryId: "health" },
    recurringTask("language", "Language practice", 20, local(MON, "10:00"), daily),
    {
      ...flexible("calc-pset", "Calculus problem set", 3 * 60, [local(MON, "00:00"), local(THU, "14:00")]),
      categoryId: "calc",
    },
    {
      ...flexible("cs-project", "CS project", 8 * 60, [local(MON, "00:00"), local(SUN, "23:00")]),
      split: { minChunkMin: 60, maxChunkMin: 2 * 60 },
      spread: "even",
      categoryId: "cs",
    },
    {
      ...flexible("essay", "Essay draft", 2 * 60, [local(MON, "00:00"), local(FRI, "17:00")]),
      spread: "just-in-time",
      categoryId: "seminar",
    },
    {
      ...flexible("reading", "Reading for seminar", 60, [local(MON, "00:00"), local(WED, "23:00")]),
      categoryId: "seminar",
    },
    flexible("side-project", "Side project", 4 * 60, [local(MON, "00:00"), local(SUN, "23:00")], "low"),
    flexible("research-paper", "Research paper", 10 * 60, [local(MON, "00:00"), local(TUE, "12:00")]),
  ];

  return { categories, fixedItems, tasks, settings };
}
