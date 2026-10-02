import { AddItemButton } from "@/components/items/item-panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { formatLocalDateRange } from "@/lib/format";
import { ScheduleLegend } from "./schedule-legend";

export function WeekHeader({ dates }: { dates: string[] }) {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">This week</p>
        <h1 className="text-2xl font-semibold tracking-tight">{formatLocalDateRange(dates[0], dates.at(-1)!)}</h1>
      </div>
      <div className="flex items-center justify-between gap-4">
        <ScheduleLegend />
        <ThemeToggle />
        <AddItemButton />
      </div>
    </header>
  );
}
