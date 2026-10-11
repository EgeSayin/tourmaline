import { expect, test } from "@playwright/test";

test.describe("categories", () => {
  test("adds a category, refuses a taken name, renames and recolours it, and deletes it", async ({
    page,
  }, testInfo) => {
    const name = `E2E course (${testInfo.project.name})`;
    await page.goto("/categories");
    const list = page.getByRole("region", { name: "Category list" });
    const entry = (text: string) => list.getByRole("link", { name: new RegExp(`^${RegExp.escape(text)}`) });

    await list.getByRole("link", { name: "New category" }).click();
    const adding = page.getByRole("complementary", { name: "New category" });
    await adding.getByLabel("Name").fill(name);
    await adding.getByRole("radio", { name: "Green" }).click();
    await adding.getByRole("button", { name: "Add category" }).click();
    await expect(adding).toBeHidden();
    await expect(entry(name)).toContainText("0 items");

    await list.getByRole("link", { name: "New category" }).click();
    await adding.getByLabel("Name").fill(`  ${name.toUpperCase()} `);
    await adding.getByRole("button", { name: "Add category" }).click();
    await expect(adding.getByText("Another category has this name")).toBeVisible();
    await adding.getByRole("link", { name: "Close" }).click();

    await entry(name).click();
    const editing = page.getByRole("complementary", { name: "Edit category" });
    await expect(editing.getByLabel("Name")).toHaveValue(name);
    await expect(editing.getByRole("radio", { name: "Green" })).toHaveAttribute("aria-checked", "true");
    await editing.getByLabel("Name").fill(`${name} renamed`);
    await editing.getByRole("radio", { name: "Purple" }).click();
    await editing.getByRole("button", { name: "Save changes" }).click();
    await expect(editing).toBeHidden();

    await entry(`${name} renamed`).click();
    await expect(editing.getByRole("radio", { name: "Purple" })).toHaveAttribute("aria-checked", "true");
    await editing.getByRole("button", { name: "Delete" }).click();
    await editing.getByRole("button", { name: "Confirm delete" }).click();
    await expect(editing).toBeHidden();
    await expect(entry(name)).toHaveCount(0);
  });
});
