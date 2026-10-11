import { connection } from "next/server";
import { BlockPanelProvider } from "@/components/schedule/block-panel-state";
import { TaskEditor } from "@/components/tasks/task-editor";
import { TaskList } from "@/components/tasks/task-list";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";

export default async function Tasks({ searchParams }: PageProps<"/tasks">) {
  await connection();
  const params = await searchParams;
  const calendar = await inPlanTransaction(db, (tx) => loadCalendar(tx, new Date()));

  if (!calendar) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">No settings saved yet.</p>
      </main>
    );
  }
  const selected = calendar.tasks.find((entry) => entry.id === params.id) ?? null;
  const editing = selected !== null || params.new !== undefined;
  return (
    <BlockPanelProvider timeZone={calendar.timeZone}>
      <main>
        <Workspace
          page="tasks"
          calendar={calendar}
          main={
            <>
              <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
              <TaskList entries={calendar.tasks} selectedId={selected?.id ?? null} timeZone={calendar.timeZone} />
            </>
          }
          editor={editing ? <TaskEditor task={selected} timeZone={calendar.timeZone} /> : null}
        />
      </main>
    </BlockPanelProvider>
  );
}
