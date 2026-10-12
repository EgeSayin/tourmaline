import { connection } from "next/server";
import { CategoryEditor } from "@/components/categories/category-editor";
import { CategoryList } from "@/components/categories/category-list";
import { Workspace } from "@/components/workspace/workspace";
import { loadCategoryList } from "@/server/categories/category-list";
import { readWorkspace } from "@/server/workspaces/current-workspace";

export default async function Categories({ searchParams }: PageProps<"/categories">) {
  await connection();
  const params = await searchParams;
  const categories = await readWorkspace(loadCategoryList);

  const selected = categories.find((entry) => entry.id === params.id) ?? null;
  const editing = selected !== null || params.new !== undefined;
  return (
    <Workspace
      page="categories"
      main={<CategoryList entries={categories} selectedId={selected?.id ?? null} />}
      editor={editing ? <CategoryEditor key={selected?.id ?? "new"} category={selected} /> : null}
    />
  );
}
