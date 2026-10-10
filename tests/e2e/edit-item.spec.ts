import { expect, test } from "@playwright/test";
import { toTimeInputValue } from "@/lib/time/time-of-day";
import { addFixedItemToday, earlySlot, localDateTime, openItemForEditing } from "./helpers";

test.describe("editing items", () => {
  test("opens an item with its values and saves changes", async ({ page }, testInfo) => {
    const title = `E2E seminar (${testInfo.project.name})`;
    const slot = earlySlot(testInfo, 1);
    const newEnd = toTimeInputValue(slot.startMinute + 15);
    await addFixedItemToday(page, testInfo, title, slot);

    const panel = await openItemForEditing(page, testInfo, title);
    await expect(panel.getByLabel("Title")).toHaveValue(title);
    await expect(panel.getByLabel("Starts")).toHaveValue(localDateTime(0, slot.start));

    await panel.getByLabel("Title").fill(`${title} renamed`);
    await panel.getByLabel("Ends").fill(localDateTime(0, newEnd));
    await panel.getByRole("button", { name: "Save changes" }).click();

    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: `${title} renamed ${slot.start}–${newEnd}` })).toBeVisible();
  });

  test("turns a fixed item into a flexible task", async ({ page }, testInfo) => {
    const title = `E2E study block (${testInfo.project.name})`;
    const slot = earlySlot(testInfo, 2);
    await addFixedItemToday(page, testInfo, title, slot);

    const panel = await openItemForEditing(page, testInfo, title);
    await panel.getByRole("radio", { name: "Find time for it" }).click();
    await panel.getByLabel("Duration (min)").fill("30");
    await panel.getByLabel("Due").fill(localDateTime(2, "20:00"));
    await panel.getByRole("button", { name: "Save changes" }).click();

    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: `${title} ${slot.label}` })).toHaveCount(0);
    await expect(page.getByText(title).first()).toBeAttached();
  });

  test("deletes an item only after confirmation", async ({ page }, testInfo) => {
    const title = `E2E cancelled meeting (${testInfo.project.name})`;
    await addFixedItemToday(page, testInfo, title, earlySlot(testInfo, 3));

    const panel = await openItemForEditing(page, testInfo, title);
    await panel.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(title)).toBeAttached();
    await panel.getByRole("button", { name: "Confirm delete" }).click();

    await expect(panel).toBeHidden();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
