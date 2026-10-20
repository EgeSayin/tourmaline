import { expect, test } from "@playwright/test";
import { addFixedItemToday, earlySlot, localDateTime, openAddItemForm } from "./helpers";

test.describe("adding items", () => {
  test("shows field errors when required fields are missing", async ({ page }) => {
    const form = await openAddItemForm(page);

    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form.getByText("Enter a title")).toBeVisible();
    await expect(form.getByText("Enter a duration, like 1h 30m")).toBeVisible();
    await expect(form.getByText("Enter a date and time")).toBeVisible();
  });

  test("schedules a new flexible task, with an optional time cleared again", async ({ page }, testInfo) => {
    const title = `E2E homework (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    const clearNotBefore = form.getByRole("button", { name: "Clear Not before" });

    await expect(clearNotBefore).toBeDisabled();
    await form.getByLabel("Not before", { exact: true }).fill(localDateTime(1, "09:00"));
    await clearNotBefore.click();
    await expect(form.getByLabel("Not before", { exact: true })).toHaveValue("");
    await expect(clearNotBefore).toBeDisabled();

    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration", { exact: true }).fill("60");
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form).toBeHidden();
    // Placed on the calendar or listed in the task queue: either way it was saved and scheduled.
    await expect(page.getByText(title).first()).toBeAttached();
  });

  test("keeps a task to a time of day picked from a preset and the slider", async ({ page }, testInfo) => {
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(`E2E practice (${testInfo.project.name})`);
    await form.getByLabel("Duration", { exact: true }).fill("5h");
    await form.getByLabel("Due").fill(localDateTime(3, "23:00"));
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

    await form.getByLabel("Duration", { exact: true }).fill("1h");
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
