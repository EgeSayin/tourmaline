import { formatLocalDateRange } from "@/lib/time/format";
import type { Week } from "@/server/calendar";
import { DateNavigator } from "./date-navigator";

function weekLabel(weeksFromToday: number): string {
  if (weeksFromToday === 0) return "This week";
  if (weeksFromToday === 1) return "Next week";
  if (weeksFromToday === -1) return "Last week";
  return weeksFromToday > 0 ? `In ${weeksFromToday} weeks` : `${-weeksFromToday} weeks ago`;
}

export function CalendarHeader({
  weekDates,
  dayDates,
  today,
  navigation,
}: Pick<Week, "weekDates" | "dayDates" | "today" | "navigation">) {
  const { week, days } = navigation;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <DateNavigator unit="week" {...week} atToday={week.weeksFromToday === 0} className="hidden md:flex" />
      <DateNavigator unit="days" {...days} atToday={dayDates[0] === today} className="flex md:hidden" />
      <div>
        <p className="hidden text-xs text-muted-foreground md:block">{weekLabel(week.weeksFromToday)}</p>
        {dayDates[0] === today && <p className="text-xs text-muted-foreground md:hidden">Today</p>}
        <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">
          <span className="hidden md:inline">{formatLocalDateRange(weekDates[0], weekDates.at(-1)!)}</span>
          <span className="md:hidden">{formatLocalDateRange(dayDates[0], dayDates.at(-1)!)}</span>
        </h1>
      </div>
    </div>
  );
}
