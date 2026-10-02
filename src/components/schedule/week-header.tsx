import { AddItemButton } from "@/components/items/item-panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { formatLocalDateRange } from "@/lib/format";
import type { WeekNavigation } from "@/server/week";
import { ScheduleLegend } from "./schedule-legend";
import { WeekNavigator } from "./week-navigator";

function weekLabel(weeksFromToday: number): string {
  if (weeksFromToday === 0) return "This week";
  if (weeksFromToday === 1) return "Next week";
  if (weeksFromToday === -1) return "Last week";
  return weeksFromToday > 0 ? `In ${weeksFromToday} weeks` : `${-weeksFromToday} weeks ago`;
}

export function WeekHeader({
  dates,
  navigation,
  queue,
}: {
  dates: string[];
  navigation: WeekNavigation;
  queue: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{weekLabel(navigation.weeksFromToday)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{formatLocalDateRange(dates[0], dates.at(-1)!)}</h1>
        </div>
        <WeekNavigator navigation={navigation} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="basis-full md:basis-auto">
          <ScheduleLegend />
        </div>
        <ThemeToggle />
        <div className="flex items-center gap-2">
          {queue}
          <AddItemButton />
        </div>
      </div>
    </header>
  );
}
