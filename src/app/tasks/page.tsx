import { connection } from "next/server";
import { TaskEditor } from "@/components/tasks/task-editor";
import { TaskList } from "@/components/tasks/task-list";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { withWorkspace } from "@/server/workspaces/current-workspace";
import { loadSchedule } from "@/server/tasks";

export default async function Tasks({ searchParams }: PageProps<"/tasks">) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const { calendar, selected, schedule } = await withWorkspace(async (tx) => {
    const calendar = await loadCalendar(tx, now);
    const selected = calendar.tasks.find((entry) => entry.id === params.id) ?? null;
    const schedule = selected
      ? await loadSchedule(tx, selected.id, now, calendar.timeZone)
      : { blocks: [], occurrences: [] };
    return { calendar, selected, schedule };
  });

  const editing = selected !== null || params.new !== undefined;
  return (
    <Workspace
      page="tasks"
      calendar={calendar}
      main={
        <>
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <TaskList
            entries={calendar.tasks}
            categories={calendar.categories}
            selectedId={selected?.id ?? null}
            timeZone={calendar.timeZone}
          />
        </>
      }
      editor={
        editing ? (
          <TaskEditor
            key={selected?.id ?? "new"}
            task={selected}
            schedule={schedule}
            categories={calendar.categories}
            timeZone={calendar.timeZone}
          />
        ) : null
      }
    />
  );
}
