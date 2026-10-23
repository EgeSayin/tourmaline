import { expect, test } from "@playwright/test";
import { itemEditor, localDateTime, openAddItemForm } from "./helpers";

test.describe("categories", () => {
  test("adds a category, refuses a taken name, renames it and gives it a custom colour, files an item under it, and deletes it", async ({
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
    await editing.getByLabel("Custom colour").fill("#0f766e");
    await expect(editing.getByRole("radio", { checked: true })).toHaveCount(0);
    await editing.getByRole("button", { name: "Save changes" }).click();
    await expect(editing).toBeHidden();

    // An item in the category shows it when opened, and keeps itself once the category is gone.
    const item = `E2E lab report (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(item);
    await form.getByLabel("Category").selectOption({ label: `${name} renamed` });
    await form.getByLabel("Duration", { exact: true }).fill("30");
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();
    await page
      .getByRole("region", { name: "Task list" })
      .getByRole("link", { name: new RegExp(`^${RegExp.escape(item)}`) })
      .click();
    await expect(itemEditor(page).getByLabel("Category").locator("option:checked")).toHaveText(`${name} renamed`);
    await page.goto("/categories");
    await expect(entry(`${name} renamed`)).toContainText("1 item");

    await entry(`${name} renamed`).click();
    await expect(editing.getByLabel("Custom colour")).toHaveValue("#0f766e");
    await editing.getByRole("button", { name: "Delete" }).click();
    await editing.getByRole("button", { name: "Confirm delete" }).click();
    await expect(editing).toBeHidden();
    await expect(entry(name)).toHaveCount(0);
    await page.goto("/tasks");
    await page
      .getByRole("region", { name: "Task list" })
      .getByRole("link", { name: new RegExp(`^${RegExp.escape(item)}`) })
      .click();
    await expect(itemEditor(page).getByLabel("Category").locator("option:checked")).toHaveText("None");
  });
});
