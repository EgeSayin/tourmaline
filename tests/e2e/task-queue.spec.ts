import { expect, test } from "@playwright/test";
import { isPhone, itemPanel, localDateTime, openAddItemForm } from "./helpers";

test.describe("task queue", () => {
  test("lists a task that can't fit, opens it with its values and drops it once deleted", async ({
    page,
  }, testInfo) => {
    const title = `E2E all-nighter (${testInfo.project.name})`;
    const form = await openAddItemForm(page, testInfo);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill(String(24 * 60)); // longer than any free stretch
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    // 30-minute chunks with breaks between need about two days of free time on their own.
    await form.getByLabel("Chunks from (min)").fill("30");
    await form.getByLabel("Chunks to (min)").fill("30");
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    if (isPhone(testInfo)) await page.getByRole("button", { name: "Queue" }).click();
    const queue = page.getByRole("region", { name: "Task queue" });
    const entry = queue.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)}`) });
    await expect(entry).toContainText("24h left");

    await entry.click();
    const panel = itemPanel(page, testInfo, "Edit item");
    await expect(panel.getByLabel("Title")).toHaveValue(title);
    await expect(panel.getByLabel("Duration (min)")).toHaveValue(String(24 * 60));
    await expect(panel.getByLabel("Chunks from (min)")).toHaveValue("30");
    await expect(panel.getByLabel("Chunks to (min)")).toHaveValue("30");

    await panel.getByRole("button", { name: "Delete" }).click();
    await panel.getByRole("button", { name: "Confirm delete" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
