import { expect, test } from "@playwright/test";
import { addFixedItemToday, earlySlot, fillDateTime, fillDuration, localDateTime, openAddItemForm } from "./helpers";

test.describe("adding items", () => {
  test("shows field errors when required fields are missing, until each field changes", async ({ page }) => {
    const form = await openAddItemForm(page);

    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form.getByText("Enter a title")).toBeVisible();
    await expect(form.getByText("Enter a duration")).toBeVisible();
    await expect(form.getByText("Enter a date and time")).toBeVisible();

    // A field shows its error until it changes, not until the next save.
    await form.getByLabel("Title").fill("E2E corrected");
    await expect(form.getByText("Enter a title")).toBeHidden();
    await expect(form.getByText("Enter a duration")).toBeVisible();
    await fillDuration(form, "Duration", 30);
    await expect(form.getByText("Enter a duration")).toBeHidden();
  });

  test("schedules a new flexible task, with an optional time cleared again", async ({ page }, testInfo) => {
    const title = `E2E homework (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    const clearNotBefore = form.getByRole("button", { name: "Clear Not before" });

    await expect(clearNotBefore).toBeDisabled();
    await fillDateTime(form, "Not before", localDateTime(1, "09:00"));
    await clearNotBefore.click();
    await expect(form.getByLabel("Not before date")).toHaveValue("");
    await expect(form.getByLabel("Not before hours")).toHaveValue("");
    await expect(clearNotBefore).toBeDisabled();

    await form.getByLabel("Title").fill(title);
    await fillDuration(form, "Duration", 60);
    await fillDateTime(form, "Due", localDateTime(2, "20:00"));
    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form).toBeHidden();
    // Placed on the calendar or listed in the task queue: either way it was saved and scheduled.
    await expect(page.getByText(title).first()).toBeAttached();
  });

  test("keeps a task to a time of day picked from a preset and the slider", async ({ page }, testInfo) => {
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(`E2E practice (${testInfo.project.name})`);
    await fillDuration(form, "Duration", 5 * 60);
    await fillDateTime(form, "Due", localDateTime(3, "23:00"));
    await expect(form.getByRole("button", { name: "Any time" })).toHaveAttribute("aria-pressed", "true");

    await form.getByRole("button", { name: "Evening" }).click();
    await expect(form.getByText("18:00–22:00")).toBeVisible();
    await form.getByRole("slider", { name: "Until" }).press("ArrowRight");
    await expect(form.getByText("18:00–22:15")).toBeVisible();
    await expect(form.getByRole("button", { name: "Evening" })).toHaveAttribute("aria-pressed", "false");
    await form.getByRole("radio", { name: "Always" }).click();

    // Five hours in one block can't fit in the evening.
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form.getByText("Its blocks are longer than these hours")).toBeVisible();

    await fillDuration(form, "Duration", 60);
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();
  });

  test("adds a fixed item at its time, defaulting to mandatory", async ({ page }, testInfo) => {
    const title = `E2E office hours (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await expect(form.getByRole("radio", { name: "Find time for it" })).toBeChecked();
    await form.getByRole("radio", { name: "At a set time" }).click();
    await expect(form.getByRole("radio", { name: "At a set time" })).toBeChecked();
    await expect(form.getByRole("radio", { name: "Find time for it" })).not.toBeChecked();
    await expect(form.getByRole("radio", { name: "Mandatory" })).toHaveAttribute("aria-checked", "true");
    await form.getByRole("link", { name: "Close" }).click();

    const slot = earlySlot(testInfo, 0);
    await addFixedItemToday(page, testInfo, title, slot);

    await expect(page.getByRole("button", { name: `${title} ${slot.label}` })).toBeVisible();
  });
});
