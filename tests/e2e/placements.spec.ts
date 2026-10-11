import { expect, test } from "@playwright/test";
import { itemPanel, localDate, localDateTime, openAddItemForm } from "./helpers";

test.describe("scheduled blocks", () => {
  test("pins and unpins a block, checks it off early and undoes that", async ({ page }, testInfo) => {
    const title = `E2E flashcards (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill("30");
    await form.getByLabel("Not before", { exact: true }).fill(localDateTime(1, "10:00"));
    await form.getByLabel("Due").fill(localDateTime(1, "22:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    // Tomorrow is always shown from its own date, on phones and in its week.
    await page.goto(`/?date=${localDate(1)}`);
    const block = page.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)} `) });
    const panel = itemPanel(page, testInfo, "Edit item");
    const act = async (action: string) => {
      await block.click();
      await panel.getByRole("button", { name: action }).click();
      await expect(panel).toBeHidden();
    };

    await act("Pin");
    await expect(block).toHaveAttribute("aria-label", /\(pinned\)$/);
    await act("Unpin");
    await expect(block).not.toHaveAttribute("aria-label", /\)$/);

    await act("Done early");
    await expect(block).toHaveAttribute("aria-label", /\(done\)$/);
    await act("Undo done");
    await expect(block).not.toHaveAttribute("aria-label", /\)$/);
  });
});
