import { expect, test } from "@playwright/test";
import { addFixedItemToday, earlySlot, localDateTime, openAddItemForm } from "./helpers";

test.describe("adding items", () => {
  test("shows field errors when required fields are missing", async ({ page }, testInfo) => {
    const form = await openAddItemForm(page, testInfo);

    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form.getByText("Enter a title")).toBeVisible();
    await expect(form.getByText("Enter a whole number of minutes")).toBeVisible();
    await expect(form.getByText("Enter a date and time")).toBeVisible();
  });

  test("schedules a new flexible task", async ({ page }, testInfo) => {
    const title = `E2E homework (${testInfo.project.name})`;
    const form = await openAddItemForm(page, testInfo);

    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill("60");
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form).toBeHidden();
    // Placed on the calendar or listed under "Couldn't fit": either way it was saved and scheduled.
    await expect(page.getByText(title).first()).toBeAttached();
  });

  test("adds a fixed item at its time, defaulting to mandatory", async ({ page }, testInfo) => {
    const title = `E2E office hours (${testInfo.project.name})`;
    const form = await openAddItemForm(page, testInfo);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await expect(form.getByLabel("Priority")).toHaveValue("mandatory");
    await form.getByRole("button", { name: "Close" }).click();

    const slot = earlySlot(testInfo, 0);
    await addFixedItemToday(page, testInfo, title, slot);

    await expect(page.getByRole("button", { name: `${title} ${slot.label}` })).toBeVisible();
  });
});
