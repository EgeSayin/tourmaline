import { connection } from "next/server";
import { ItemPanelProvider } from "@/components/items/item-panel";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { TaskQueue } from "@/components/schedule/task-queue";
import { WeekGrid } from "@/components/schedule/week-grid";
import { WeekHeader } from "@/components/schedule/week-header";
import { db } from "@/server/db/client";
import { dayNavigation, parseDateParam, weekNavigation } from "@/server/week";
import { loadWeekSchedule } from "@/server/week-schedule";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const shownDate = parseDateParam((await searchParams).date);
  const week = await loadWeekSchedule(db, Temporal.Now.instant(), shownDate);

  if (!week) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">No settings saved yet.</p>
      </main>
    );
  }

  return (
    <ItemPanelProvider timeZone={week.timeZone}>
      <main>
        <ScheduleView
          calendarHeader={
            <WeekHeader
              weekDates={week.weekDates}
              dayDates={week.dayDates}
              today={week.today}
              weekNavigation={weekNavigation(week.weekDates[0], week.today)}
              dayNavigation={dayNavigation(week.dayDates[0], week.dayDates.length)}
            />
          }
          queue={<TaskQueue tasks={week.unplaced} flexibleItems={week.flexibleItems} timeZone={week.timeZone} />}
          queueCount={week.unplaced.length}
          calendar={[week.weekDates, week.dayDates].map((dates, i) => (
            <WeekGrid
              key={`${i}-${dates[0]}`}
              className={i === 0 ? "hidden md:block" : "md:hidden"}
              today={week.today}
              dates={dates}
              fixedItems={week.fixedItems}
              flexibleItems={week.flexibleItems}
              placements={week.placements}
              timeZone={week.timeZone}
            />
          ))}
        />
      </main>
    </ItemPanelProvider>
  );
}
