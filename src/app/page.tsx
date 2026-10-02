import { connection } from "next/server";
import { ItemPanelLayout, ItemPanelProvider } from "@/components/items/item-panel";
import { UnplacedTasks } from "@/components/schedule/unplaced-tasks";
import { WeekGrid } from "@/components/schedule/week-grid";
import { WeekHeader } from "@/components/schedule/week-header";
import { db } from "@/server/db/client";
import { loadWeekSchedule } from "@/server/week-schedule";

export default async function Home() {
  await connection();
  const week = await loadWeekSchedule(db, Temporal.Now.instant());

  if (!week) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">No settings saved yet.</p>
      </main>
    );
  }

  return (
    <ItemPanelProvider timeZone={week.timeZone}>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:py-10">
        <WeekHeader dates={week.dates} />
        <ItemPanelLayout>
          <UnplacedTasks tasks={week.unplaced} timeZone={week.timeZone} />
          <WeekGrid
            range={week.range}
            fixedItems={week.fixedItems}
            flexibleItems={week.flexibleItems}
            placements={week.placements}
            timeZone={week.timeZone}
          />
        </ItemPanelLayout>
      </main>
    </ItemPanelProvider>
  );
}
