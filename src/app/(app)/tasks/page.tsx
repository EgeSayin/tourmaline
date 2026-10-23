import { connection } from "next/server";
import { TaskEditor } from "@/components/tasks/task-editor";
import { TaskList } from "@/components/tasks/task-list";
import { Workspace } from "@/components/workspace/workspace";
import { parseDateParam } from "@/server/time/days";
import { readWorkspace } from "@/server/workspaces/current-workspace";
import { loadItemList, loadOccurrenceEdit, loadSchedule } from "@/server/tasks";

export default async function Tasks({ searchParams }: PageProps<"/tasks">) {
  await connection();
  const params = await searchParams;
  const { list, selected, schedule, occurrence } = await readWorkspace(async (tx, now) => {
    const list = await loadItemList(tx, now);
    const selected = list.items.find((entry) => entry.id === params.id) ?? null;
    const schedule = selected
      ? await loadSchedule(tx, selected.id, now, list.timeZone)
      : { blocks: [], occurrences: [] };
    const date = parseDateParam(params.date);
    const occurrence =
      selected?.recurring && date ? await loadOccurrenceEdit(tx, selected.id, date.toString(), list.timeZone) : null;
    return { list, selected, schedule, occurrence };
  });

  const editing = selected !== null || params.new !== undefined;
  return (
    <Workspace
      page="tasks"
      main={
        <>
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <TaskList
            entries={list.items}
            categories={list.categories}
            selectedId={selected?.id ?? null}
            timeZone={list.timeZone}
          />
        </>
      }
      editor={
        editing ? (
          <TaskEditor
            key={`${selected?.id ?? "new"}@${occurrence?.date ?? ""}`}
            task={selected}
            occurrence={occurrence}
            schedule={schedule}
            categories={list.categories}
            timeZone={list.timeZone}
          />
        ) : null
      }
    />
  );
}
