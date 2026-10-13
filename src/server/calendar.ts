import { type CalendarBlock, toCalendarBlocks } from "@/lib/calendar-blocks";
import { isFixed } from "@/lib/items";
import type { Downtime } from "@/lib/downtime";
import { later } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { type CategoryEntry, listCategories } from "@/server/categories/category-list";
import { loadCategories } from "@/server/db/categories-repository";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadItems } from "@/server/db/items-repository";
import { loadPlacements } from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { focusDays } from "@/server/scheduler/focus-cap";
import { expandOccurrences } from "@/server/recurrence";
import { editTargets } from "@/server/edit-targets";
import {
  type DayNavigation,
  dayNavigation,
  daysFrom,
  PHONE_DAY_COUNT,
  type WeekNavigation,
  weekNavigation,
  weekOf,
} from "@/server/time/days";
import { localDate } from "@/server/time/temporal";

/** How much of a day its fixed items and blocks fill, missed ones aside, against its focus cap. */
export interface DayLoad {
  usedMin: number;
  capMin: number | null;
}

export interface Week {
  timeZone: TimeZone;
  /** Local dates of the week containing the shown date, Monday first. */
  weekDates: string[];
  /** Local dates of the `PHONE_DAY_COUNT` days starting on the shown date. */
  dayDates: string[];
  today: string;
  navigation: { week: WeekNavigation; days: DayNavigation };
  blocks: CalendarBlock[];
  loads: Record<string, DayLoad>;
  downtime: Downtime;
  categories: CategoryEntry[];
}

/** Loads the week and the phone days from `shownDate` (default: today). */
export async function loadWeek(tx: WorkspaceTx, now: Date, shownDate?: Temporal.PlainDate): Promise<Week> {
  const [settings, items, categories] = await Promise.all([loadSettings(tx), loadItems(tx), loadCategories(tx)]);
  const { timeZone } = settings;

  const today = localDate(now, timeZone);
  const week = weekOf(shownDate ?? today, timeZone);
  const days = daysFrom(shownDate ?? today, PHONE_DAY_COUNT, timeZone);
  const shown = { start: week.range.start, end: later(days.range.end, week.range.end) };
  const fixedItems = items.filter(isFixed).flatMap((item) => expandOccurrences(item, shown, timeZone));
  const placements = await loadPlacements(tx, shown);
  const busy = [...fixedItems, ...placements.filter((placement) => placement.status !== "missed")];

  return {
    timeZone,
    weekDates: week.dates,
    dayDates: days.dates,
    today: today.toString(),
    navigation: {
      week: weekNavigation(week.dates[0], today.toString()),
      days: dayNavigation(days.dates[0], PHONE_DAY_COUNT),
    },
    blocks: toCalendarBlocks(fixedItems, placements, timeZone, editTargets(items, now, timeZone), categories, now),
    loads: Object.fromEntries(
      focusDays(shown, busy, settings.focusCaps, timeZone).map(({ date, usedMin, capMin }) => [
        date,
        { usedMin, capMin },
      ]),
    ),
    downtime: settings.downtime,
    categories: listCategories(categories, items),
  };
}
