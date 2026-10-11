import { connection } from "next/server";
import { CategoryEditor } from "@/components/categories/category-editor";
import { CategoryList } from "@/components/categories/category-list";
import { BlockPanelProvider } from "@/components/schedule/block-panel-state";
import { Workspace } from "@/components/workspace/workspace";
import { loadCalendar } from "@/server/calendar";
import { db } from "@/server/db/client";
import { inPlanTransaction } from "@/server/db/plan-lock";

export default async function Categories({ searchParams }: PageProps<"/categories">) {
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
  const selected = calendar.categories.find((entry) => entry.id === params.id) ?? null;
  const editing = selected !== null || params.new !== undefined;
  return (
    <BlockPanelProvider timeZone={calendar.timeZone}>
      <main>
        <Workspace
          page="categories"
          calendar={calendar}
          main={<CategoryList entries={calendar.categories} selectedId={selected?.id ?? null} />}
          editor={editing ? <CategoryEditor key={selected?.id ?? "new"} category={selected} /> : null}
        />
      </main>
    </BlockPanelProvider>
  );
}
