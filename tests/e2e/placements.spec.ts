import { expect, test } from "@playwright/test";
import { blockPanel, itemEditor, localDate, localDateTime, openAddItemForm } from "./helpers";

test.describe("scheduled blocks", () => {
  test("pins and unpins a block, checks it off early and undoes that, from the calendar and from its task", async ({
    page,
  }, testInfo) => {
    const title = `E2E flashcards (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration", { exact: true }).fill("30");
    await form.getByLabel("Not before", { exact: true }).fill(localDateTime(1, "10:00"));
    await form.getByLabel("Due").fill(localDateTime(1, "22:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    // Tomorrow is always shown from its own date, on phones and in its week.
    await page.goto(`/?date=${localDate(1)}`);
    const block = page.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)} `) });
    const panel = blockPanel(page, testInfo);
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

    await block.click();
    await panel.getByRole("link", { name: "Open task" }).click();
    const blocks = itemEditor(page).getByRole("group", { name: "Blocks" });
    await expect(blocks.getByText(/· Planned$/)).toBeVisible();
    await blocks.getByRole("button", { name: "Done early" }).click();
    await expect(blocks.getByText(/· Done$/)).toBeVisible();
    await blocks.getByRole("button", { name: "Undo done" }).click();
    await expect(blocks.getByText(/· Planned$/)).toBeVisible();
  });
});
