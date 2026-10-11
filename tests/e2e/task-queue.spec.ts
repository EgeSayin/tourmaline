import { expect, test } from "@playwright/test";
import { itemEditor, localDateTime, openAddItemForm, showQueue } from "./helpers";

test.describe("task queue", () => {
  test("lists a task that can't fit, opens its task with its values and drops it once deleted", async ({
    page,
  }, testInfo) => {
    const title = `E2E all-nighter (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill(String(24 * 60)); // longer than any free stretch
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    // 30-minute chunks with breaks between need about two days of free time on their own.
    await form.getByLabel("Chunks from (min)").fill("30");
    await form.getByLabel("Chunks to (min)").fill("30");
    await form.getByLabel("Spread").selectOption("even");
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    const queue = await showQueue(page, testInfo);
    const entry = queue.getByRole("link", { name: new RegExp(`^${RegExp.escape(title)}`) });
    await expect(entry).toContainText("24h left");

    await entry.click();
    const panel = itemEditor(page);
    await expect(panel.getByLabel("Title")).toHaveValue(title);
    await expect(panel.getByLabel("Duration (min)")).toHaveValue(String(24 * 60));
    await expect(panel.getByLabel("Chunks from (min)")).toHaveValue("30");
    await expect(panel.getByLabel("Chunks to (min)")).toHaveValue("30");
    await expect(panel.getByLabel("Spread")).toHaveValue("even");

    await panel.getByRole("button", { name: "Delete" }).click();
    await panel.getByRole("button", { name: "Confirm delete" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("marks a task done from the queue, taking it off", async ({ page }, testInfo) => {
    const title = `E2E impossible essay (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill(String(24 * 60)); // longer than any free stretch
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    const entry = (await showQueue(page, testInfo)).getByRole("link", {
      name: new RegExp(`^${RegExp.escape(title)}`),
    });
    await entry.click();
    const panel = itemEditor(page);
    await panel.getByRole("button", { name: "Mark done" }).click();

    await expect(panel).toBeHidden();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
