import { connection } from "next/server";
import { CategoryFilterSelect } from "@/components/categories/category-filter";
import { BlockPanelProvider } from "@/components/schedule/block-panel-state";
import { CalendarGrid } from "@/components/schedule/calendar-grid";
import { CalendarHeader } from "@/components/schedule/calendar-header";
import { ScheduleLegend } from "@/components/schedule/schedule-legend";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { parseDateParam } from "@/server/time/days";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const shownDate = parseDateParam((await searchParams).date);
  const calendar = await inPlanTransaction(db, (tx) => loadCalendar(tx, new Date(), shownDate));

  if (!calendar) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">No settings saved yet.</p>
      </main>
    );
  }

  return (
    <BlockPanelProvider timeZone={calendar.timeZone}>
      <main>
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
                timeZone={calendar.timeZone}
              />
            </>
          }
        />
      </main>
    </BlockPanelProvider>
  );
}
