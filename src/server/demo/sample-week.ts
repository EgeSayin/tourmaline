import "server-only";
import type { FixedItem, FlexibleItem, Priority } from "@/lib/items";
import { DEFAULT_SETTINGS, type SchedulerSettings } from "@/lib/settings";
import { toDate } from "@/server/temporal";
import { weekContaining } from "@/server/week";

const settings: SchedulerSettings = { ...DEFAULT_SETTINGS, timeZone: "America/New_York" };

function local(date: string, time: string): Date {
  return toDate(Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(settings.timeZone));
}

function fixed(
  id: string,
  title: string,
  date: string,
  [from, to]: [string, string],
  options: Partial<Pick<FixedItem, "priority" | "location" | "bufferBeforeMin" | "bufferAfterMin">> = {},
): FixedItem {
  return {
    id,
    title,
    timing: "fixed",
    start: local(date, from),
    end: local(date, to),
    priority: "mandatory",
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
): FlexibleItem {
  return {
    id,
    title,
    timing: "flexible",
    priority,
    durationMin,
    earliestStart,
    deadline,
    split: null,
    preferredWindows: [],
    spread: "asap",
  };
}

const lectureBuffers = { location: "Science Hall 101", bufferBeforeMin: 15, bufferAfterMin: 15 };

/** A student's week of fixed and flexible items, in the week (Monday–Sunday) containing `now`. */
export function sampleWeek(now: Temporal.Instant) {
  const { monday } = weekContaining(now, settings.timeZone);
  const week = Array.from({ length: 7 }, (_, i) => monday.add({ days: i }).toString());
  const [MON, TUE, WED, THU, FRI, SAT, SUN] = week;

  const fixedItems: FixedItem[] = [
    ...[MON, WED, FRI].map((d) => fixed(`cs-${d}`, "CS 101 lecture", d, ["11:00", "12:15"], lectureBuffers)),
    ...[TUE, THU].map((d) => fixed(`calc-${d}`, "Calculus lecture", d, ["14:00", "15:30"], lectureBuffers)),
    ...[TUE, THU].map((d) => fixed(`gym-${d}`, "Gym", d, ["17:00", "18:00"], { priority: "high" })),
    fixed("chess", "Chess club", WED, ["18:00", "19:30"], { priority: "normal" }),
    fixed("hangout", "Dinner with friends", SAT, ["19:00", "22:00"], { priority: "normal" }),
  ];

  const flexibleItems: FlexibleItem[] = [
    ...week.map((d) => flexible(`lunch-${d}`, "Lunch", 45, [local(d, "11:30"), local(d, "14:30")], "mandatory")),
    flexible("calc-pset", "Calculus problem set", 3 * 60, [local(MON, "00:00"), local(THU, "14:00")]),
    flexible("cs-project", "CS project", 8 * 60, [local(MON, "00:00"), local(SUN, "23:00")]),
    flexible("essay", "Essay draft", 2 * 60, [local(MON, "00:00"), local(FRI, "17:00")]),
    flexible("reading", "Reading for seminar", 60, [local(MON, "00:00"), local(WED, "23:00")]),
    flexible("side-project", "Side project", 4 * 60, [local(MON, "00:00"), local(SUN, "23:00")], "low"),
    flexible("research-paper", "Research paper", 10 * 60, [local(MON, "00:00"), local(TUE, "12:00")]),
  ];

  return { fixedItems, flexibleItems, settings };
}
