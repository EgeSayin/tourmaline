import { CATEGORY_PRESETS, type NewCategory } from "@/lib/categories";
import type { NewFixedItem, NewTask, Priority } from "@/lib/items";
import type { Recurrence, Weekday } from "@/lib/recurrence";
import { DEFAULT_CHUNK_BREAK_MIN, DEFAULT_SETTINGS, type SchedulerSettings } from "@/lib/settings";
import { withFirstDeadline } from "@/server/recurrence";
import { daysFrom, weekOf } from "@/server/time/days";
import { localDate, startOfDay, toDate } from "@/server/time/temporal";

const settings: SchedulerSettings = { ...DEFAULT_SETTINGS, timeZone: "America/New_York" };

function local(date: string, time: string): Date {
  return toDate(Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(settings.timeZone));
}

function fixed(
  title: string,
  date: string,
  [from, to]: [string, string],
  options: Partial<
    Pick<NewFixedItem, "priority" | "recurrence" | "location" | "bufferBeforeMin" | "bufferAfterMin" | "categoryId">
  > = {},
): NewFixedItem {
  return {
    title,
    timing: "fixed",
    start: local(date, from),
    end: local(date, to),
    dayTimes: null,
    priority: "mandatory",
    recurrence: null,
    categoryId: null,
    location: null,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    ...options,
  };
}

function flexible(
  title: string,
  durationMin: number,
  [earliestStart, deadline]: [Date, Date],
  priority: Priority = "normal",
): NewTask {
  return {
    title,
    timing: "flexible",
    priority,
    recurrence: null,
    categoryId: null,
    durationMin,
    dayDurations: null,
    earliestStart,
    deadline,
    split: null,
    spread: "asap",
    withinPeriod: false,
    upTo: false,
    totalMin: null,
    timeOfDay: null,
  };
}

function recurringTask(
  title: string,
  durationMin: number,
  earliestStart: Date,
  recurrence: Recurrence,
  priority: Priority = "normal",
  withinPeriod = false,
): NewTask {
  const { deadline: _, ...task } = flexible(title, durationMin, [earliestStart, earliestStart], priority);
  return withFirstDeadline<NewTask>({ ...task, recurrence, withinPeriod }, settings.timeZone)!;
}

/** Keyed by the `categoryId` the sample items use until the seed saves them. */
const categories: Record<string, NewCategory> = {
  cs: { name: "CS 101", color: CATEGORY_PRESETS.Blue },
  calc: { name: "Calculus", color: CATEGORY_PRESETS.Orange },
  seminar: { name: "Seminar", color: CATEGORY_PRESETS.Purple },
  health: { name: "Health", color: CATEGORY_PRESETS.Green },
};

const lectureBuffers = { location: "Science Hall 101", bufferBeforeMin: 15, bufferAfterMin: 15 };
/** Weekly on the weekdays of `dates`. */
const weekly = (...dates: string[]): Recurrence => ({
  frequency: "weekly",
  interval: 1,
  weekdays: dates.map((date) => Temporal.PlainDate.from(date).dayOfWeek as Weekday),
  until: null,
});
const daily: Recurrence = { frequency: "daily", interval: 1, until: null };

/** The first date from `from` that `recurrence` falls on. */
function firstDate(recurrence: Recurrence, from: Temporal.PlainDate): string {
  let date = from;
  while (recurrence.frequency === "weekly" && !recurrence.weekdays.includes(date.dayOfWeek as Weekday)) {
    date = date.add({ days: 1 });
  }
  return date.toString();
}

/** How many of the sample's seven days are already past, so every visitor starts the same way into it. */
const SAMPLE_DAYS_PAST = 2;

/**
 * A student's seven days of fixed items and tasks, starting `SAMPLE_DAYS_PAST` days before `now`'s, and the categories
 * they belong to. Lectures, chess club, lunch, gym and language practice repeat from the first of those days, or from
 * the Monday of today's week if that's earlier, and the open-ended projects run to the later of the last day and that
 * week's Sunday, so a week view of today has no empty days. Today, a guest talk overlaps chess club; on the sixth
 * day, an application fits only over dinner with friends, which gives way.
 */
export function sampleWeek(now: Date) {
  const today = localDate(now, settings.timeZone);
  const days = daysFrom(today.subtract({ days: SAMPLE_DAYS_PAST }), 7, settings.timeZone);
  // Named for a Monday start: today is always the third day, "WED", whatever the weekday.
  const [MON, TUE, WED, THU, FRI, SAT, SUN] = days.dates;
  const week = weekOf(today, settings.timeZone).dates;
  const repeatFrom = Temporal.PlainDate.from(MON < week[0] ? MON : week[0]);
  const lastDay = SUN > week[6] ? SUN : week[6];
  const from = (recurrence: Recurrence) => firstDate(recurrence, repeatFrom);
  const [lectures, calculus, chess, gym] = [
    weekly(MON, WED, FRI),
    weekly(TUE, THU),
    weekly(WED),
    weekly(TUE, THU, SAT),
  ];

  const fixedItems: NewFixedItem[] = [
    fixed("CS 101 lecture", from(lectures), ["11:00", "12:15"], {
      ...lectureBuffers,
      recurrence: lectures,
      categoryId: "cs",
    }),
    fixed("Calculus lecture", from(calculus), ["14:00", "15:30"], {
      ...lectureBuffers,
      recurrence: calculus,
      categoryId: "calc",
    }),
    fixed("Chess club", from(chess), ["18:00", "19:30"], { priority: "normal", recurrence: chess }),
    fixed("Guest talk", WED, ["17:30", "19:00"], { location: "Main auditorium", categoryId: "seminar" }),
    fixed("Dinner with friends", SAT, ["19:00", "22:00"], { priority: "normal" }),
  ];

  const tasks: NewTask[] = [
    // Kept within its day: a missed lunch isn't eaten the next morning.
    recurringTask("Lunch", 45, local(from(daily), "11:30"), daily, "mandatory", true),
    {
      ...recurringTask("Gym", 60, local(from(gym), "17:00"), gym, "high"),
      categoryId: "health",
      timeOfDay: { startMinute: 17 * 60, endMinute: 21 * 60, must: true },
    },
    {
      ...recurringTask("Language practice", 20, local(from(daily), "10:00"), daily),
      timeOfDay: { startMinute: 8 * 60, endMinute: 12 * 60, must: false },
    },
    {
      ...flexible("Calculus problem set", 3 * 60, [local(MON, "00:00"), local(THU, "14:00")]),
      categoryId: "calc",
    },
    {
      ...flexible("CS project", 8 * 60, [local(MON, "00:00"), local(lastDay, "23:00")]),
      split: { minChunkMin: 60, maxChunkMin: 2 * 60, breakMin: DEFAULT_CHUNK_BREAK_MIN },
      spread: "even",
      categoryId: "cs",
    },
    {
      ...flexible("Essay draft", 2 * 60, [local(MON, "00:00"), local(FRI, "17:00")]),
      spread: "just-in-time",
      categoryId: "seminar",
    },
    {
      ...flexible("Reading for seminar", 60, [local(MON, "00:00"), local(WED, "23:00")]),
      categoryId: "seminar",
    },
    flexible("Side project", 4 * 60, [local(MON, "00:00"), local(lastDay, "23:00")], "low"),
    flexible("Research paper", 10 * 60, [local(MON, "00:00"), local(TUE, "12:00")]),
    // Opens Saturday evening and fits only over dinner, which is optional, so dinner gives way.
    flexible("Scholarship application", 2 * 60, [local(SAT, "18:00"), local(SAT, "21:00")], "high"),
  ];

  return { categories, fixedItems, tasks, settings, planFrom: startOfDay(repeatFrom, settings.timeZone) };
}
