import { connection } from "next/server";
import { ItemPanelProvider } from "@/components/items/item-panel-state";
import { CalendarGrid } from "@/components/schedule/calendar-grid";
import { CalendarHeader } from "@/components/schedule/calendar-header";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { TaskQueue } from "@/components/schedule/task-queue";
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
              blocks={calendar.blocks}
              timeZone={calendar.timeZone}
            />
          }
        />
      </main>
    </ItemPanelProvider>
  );
}
