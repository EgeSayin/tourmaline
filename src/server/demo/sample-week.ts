import "server-only";
import type { FixedItem, FlexibleItem, Priority } from "@/lib/items";
import type { Recurrence, Weekday } from "@/lib/recurrence";
import { DEFAULT_SETTINGS, type SchedulerSettings } from "@/lib/settings";
import { weekContaining } from "@/server/days";
import { toDate } from "@/server/temporal";

const settings: SchedulerSettings = { ...DEFAULT_SETTINGS, timeZone: "America/New_York" };

function local(date: string, time: string): Date {
  return toDate(Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(settings.timeZone));
}

function fixed(
  id: string,
  title: string,
  date: string,
  [from, to]: [string, string],
  options: Partial<Pick<FixedItem, "priority" | "recurrence" | "location" | "bufferBeforeMin" | "bufferAfterMin">> = {},
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
    location: null,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    ...options,
  };
}

function flexible(
  id: string,
  title: string,
  durationMin: number,
  [earliestStart, deadline]: [Date, Date],
  priority: Priority = "normal",
  recurrence: Recurrence | null = null,
): FlexibleItem {
  return {
    id,
    title,
    timing: "flexible",
    priority,
    recurrence,
    overrides: [],
    durationMin,
    earliestStart,
    deadline,
    split: null,
    preferredWindows: [],
    spread: "asap",
  };
}

const lectureBuffers = { location: "Science Hall 101", bufferBeforeMin: 15, bufferAfterMin: 15 };
const weekly = (...weekdays: Weekday[]): Recurrence => ({ frequency: "weekly", interval: 1, weekdays, until: null });
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };

/**
 * A student's week of fixed and flexible items, in the week (Monday–Sunday) containing `now`. Lectures, chess club,
 * gym and language practice repeat from that week on.
 */
export function sampleWeek(now: Temporal.Instant) {
  const week = weekContaining(now, settings.timeZone).dates;
  const [MON, TUE, WED, THU, FRI, SAT, SUN] = week;

  const fixedItems: FixedItem[] = [
    fixed("cs", "CS 101 lecture", MON, ["11:00", "12:15"], { ...lectureBuffers, recurrence: weekly(1, 3, 5) }),
    fixed("calc", "Calculus lecture", TUE, ["14:00", "15:30"], { ...lectureBuffers, recurrence: weekly(2, 4) }),
    fixed("chess", "Chess club", WED, ["18:00", "19:30"], { priority: "normal", recurrence: weekly(3) }),
    fixed("hangout", "Dinner with friends", SAT, ["19:00", "22:00"], { priority: "normal" }),
  ];

  const flexibleItems: FlexibleItem[] = [
    ...week.map((d) => flexible(`lunch-${d}`, "Lunch", 45, [local(d, "11:30"), local(d, "14:30")], "mandatory")),
    // A recurring task's stored deadline is its first window's end, where the rule next occurs.
    flexible("gym", "Gym", 60, [local(TUE, "17:00"), local(THU, "17:00")], "high", weekly(2, 4, 6)),
    flexible("language", "Language practice", 20, [local(MON, "10:00"), local(TUE, "10:00")], "normal", daily),
    flexible("calc-pset", "Calculus problem set", 3 * 60, [local(MON, "00:00"), local(THU, "14:00")]),
    flexible("cs-project", "CS project", 8 * 60, [local(MON, "00:00"), local(SUN, "23:00")]),
    flexible("essay", "Essay draft", 2 * 60, [local(MON, "00:00"), local(FRI, "17:00")]),
    flexible("reading", "Reading for seminar", 60, [local(MON, "00:00"), local(WED, "23:00")]),
    flexible("side-project", "Side project", 4 * 60, [local(MON, "00:00"), local(SUN, "23:00")], "low"),
    flexible("research-paper", "Research paper", 10 * 60, [local(MON, "00:00"), local(TUE, "12:00")]),
  ];

  return { fixedItems, flexibleItems, settings };
}
