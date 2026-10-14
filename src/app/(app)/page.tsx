import { connection } from "next/server";
import { CategoryFilterSelect } from "@/components/categories/category-filter";
import { CalendarGrid } from "@/components/schedule/calendar-grid";
import { CalendarHeader } from "@/components/schedule/calendar-header";
import { ScheduleLegend } from "@/components/schedule/schedule-legend";
import { Workspace } from "@/components/workspace/workspace";
import { loadWeek } from "@/server/calendar";
import { parseDateParam } from "@/server/time/days";
import { readWorkspace } from "@/server/workspaces/current-workspace";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const shownDate = parseDateParam((await searchParams).date);
  const week = await readWorkspace((tx, now) => loadWeek(tx, now, shownDate));

  return (
    <Workspace
      page="calendar"
      main={
        <>
          <CalendarHeader
            weekDates={week.weekDates}
            dayDates={week.dayDates}
            today={week.today}
            navigation={week.navigation}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ScheduleLegend />
            <CategoryFilterSelect categories={week.categories} />
          </div>
          <CalendarGrid
            today={week.today}
            weekDates={week.weekDates}
            dayDates={week.dayDates}
            blocks={week.blocks}
            downtime={week.downtime}
            timeZone={week.timeZone}
          />
        </>
      }
    />
  );
}
