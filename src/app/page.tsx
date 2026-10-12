import { connection } from "next/server";
import { CategoryFilterSelect } from "@/components/categories/category-filter";
import { CalendarGrid } from "@/components/schedule/calendar-grid";
import { CalendarHeader } from "@/components/schedule/calendar-header";
import { ScheduleLegend } from "@/components/schedule/schedule-legend";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { parseDateParam } from "@/server/time/days";
import { readWorkspace } from "@/server/workspaces/current-workspace";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const shownDate = parseDateParam((await searchParams).date);
  const calendar = await readWorkspace((tx, now) => loadCalendar(tx, now, shownDate));

  return (
    <Workspace
      page="calendar"
      calendar={calendar}
      main={
        <>
          <CalendarHeader
            weekDates={calendar.weekDates}
            dayDates={calendar.dayDates}
            today={calendar.today}
            navigation={calendar.navigation}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ScheduleLegend />
            <CategoryFilterSelect categories={calendar.categories} />
          </div>
          <CalendarGrid
            today={calendar.today}
            weekDates={calendar.weekDates}
            dayDates={calendar.dayDates}
            blocks={calendar.blocks}
            loads={calendar.loads}
            downtime={calendar.downtime}
            timeZone={calendar.timeZone}
          />
        </>
      }
    />
  );
}
