import { expect, test } from "@playwright/test";
import { itemEditor, localDateTime, openAddItemForm, showQueue } from "./helpers";

test.describe("task queue", () => {
  test("lists a task that can't fit, opens its task with its values and drops it once deleted", async ({
    page,
  }, testInfo) => {
    const title = `E2E all-nighter (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration", { exact: true }).fill(String(24 * 60)); // longer than any free stretch
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    // 30-minute chunks with breaks between need about two days of free time on their own.
    await form.getByRole("radio", { name: "Split it up" }).click();
    await form.getByLabel("Shortest block").fill("30");
    await form.getByLabel("Longest block").fill("30m");
    await form.getByRole("radio", { name: "Evenly" }).click();
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    const queue = await showQueue(page, testInfo);
    const entry = queue.getByRole("link", { name: new RegExp(`^${RegExp.escape(title)}`) });
    await expect(entry).toContainText("24h left");

    await entry.click();
    const panel = itemEditor(page);
    await expect(panel.getByLabel("Title")).toHaveValue(title);
    await expect(panel.getByLabel("Duration", { exact: true })).toHaveValue("24h");
    await expect(panel.getByLabel("Shortest block")).toHaveValue("30m");
    await expect(panel.getByLabel("Longest block")).toHaveValue("30m");
    await expect(panel.getByRole("radio", { name: "Evenly" })).toHaveAttribute("aria-checked", "true");

    await panel.getByRole("button", { name: "Delete" }).click();
    await panel.getByRole("button", { name: "Confirm delete" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("marks a task done from the queue, taking it off", async ({ page }, testInfo) => {
    const title = `E2E impossible essay (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration", { exact: true }).fill(String(24 * 60)); // longer than any free stretch
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
