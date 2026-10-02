import { formatLocalDateRange } from "@/lib/format";
import type { DayNavigation, WeekNavigation } from "@/server/week";
import { WeekNavigator } from "./week-navigator";

function weekLabel(weeksFromToday: number): string {
  if (weeksFromToday === 0) return "This week";
  if (weeksFromToday === 1) return "Next week";
  if (weeksFromToday === -1) return "Last week";
  return weeksFromToday > 0 ? `In ${weeksFromToday} weeks` : `${-weeksFromToday} weeks ago`;
}

/** Steps by week with the week's dates on tablets and up; by `dayDates.length` days with those dates on phones. */
export function WeekHeader({
  weekDates,
  dayDates,
  today,
  weekNavigation,
  dayNavigation,
}: {
  weekDates: string[];
  dayDates: string[];
  today: string;
  weekNavigation: WeekNavigation;
  dayNavigation: DayNavigation;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <WeekNavigator
        unit="week"
        {...weekNavigation}
        atToday={weekNavigation.weeksFromToday === 0}
        className="hidden md:flex"
      />
      <WeekNavigator unit="days" {...dayNavigation} atToday={dayDates[0] === today} className="flex md:hidden" />
      <div>
        <p className="text-xs text-muted-foreground">{weekLabel(weekNavigation.weeksFromToday)}</p>
        <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">
          <span className="hidden md:inline">{formatLocalDateRange(weekDates[0], weekDates.at(-1)!)}</span>
          <span className="md:hidden">{formatLocalDateRange(dayDates[0], dayDates.at(-1)!)}</span>
        </h1>
      </div>
    </div>
  );
}
