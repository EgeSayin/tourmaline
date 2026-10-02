import { connection } from "next/server";
import { ItemPanelProvider } from "@/components/items/item-panel";
import { CalendarGrid } from "@/components/schedule/calendar-grid";
import { CalendarHeader } from "@/components/schedule/calendar-header";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { TaskQueue } from "@/components/schedule/task-queue";
import { loadCalendar } from "@/server/calendar";
import { parseDateParam } from "@/server/days";
import { db } from "@/server/db/client";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const shownDate = parseDateParam((await searchParams).date);
  const calendar = await loadCalendar(db, Temporal.Now.instant(), shownDate);

  if (!calendar) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">No settings saved yet.</p>
      </main>
    );
  }

  return (
    <ItemPanelProvider timeZone={calendar.timeZone}>
      <main>
        <ScheduleView
          calendarHeader={
            <CalendarHeader
              weekDates={calendar.weekDates}
              dayDates={calendar.dayDates}
              today={calendar.today}
              navigation={calendar.navigation}
            />
          }
          queue={<TaskQueue entries={calendar.queue} timeZone={calendar.timeZone} />}
          queueCount={calendar.queue.length}
          calendar={
            <CalendarGrid
              today={calendar.today}
              weekDates={calendar.weekDates}
              dayDates={calendar.dayDates}
              fixedItems={calendar.fixedItems}
              flexibleItems={calendar.flexibleItems}
              placements={calendar.placements}
              timeZone={calendar.timeZone}
            />
          }
        />
      </main>
    </ItemPanelProvider>
  );
}
