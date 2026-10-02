import { ScheduleLegend } from "@/components/schedule/schedule-legend";
import { UnplacedTasks } from "@/components/schedule/unplaced-tasks";
import { WeekGrid } from "@/components/schedule/week-grid";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { formatLocalDateRange } from "@/lib/format";
import { localDatesInRange } from "@/lib/local-time";
import { sampleWeek } from "@/server/demo/sample-week";
import { schedule } from "@/server/scheduler/schedule";

export default function Home() {
  const { range, fixedItems, flexibleItems, settings } = sampleWeek();
  const { placements, unplaced } = schedule(range, fixedItems, flexibleItems, settings);
  const dates = localDatesInRange(range, settings.timeZone);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:py-10">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">This week</p>
          <h1 className="text-2xl font-semibold tracking-tight">{formatLocalDateRange(dates[0], dates.at(-1)!)}</h1>
        </div>
        <div className="flex items-center justify-between gap-4">
          <ScheduleLegend />
          <ThemeToggle />
        </div>
      </header>
      <UnplacedTasks tasks={unplaced} timeZone={settings.timeZone} />
      <WeekGrid range={range} fixedItems={fixedItems} flexibleItems={flexibleItems} placements={placements} timeZone={settings.timeZone} />
    </main>
  );
}
