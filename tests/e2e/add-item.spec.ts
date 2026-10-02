import { expect, type Page, test } from "@playwright/test";

// Matches the seeded settings.
const TIME_ZONE = "America/New_York";

/** A local `datetime-local` value `days` from today, in the seeded time zone. */
function localDateTime(days: number, time: string): string {
  return `${Temporal.Now.plainDateISO(TIME_ZONE).add({ days })}T${time}`;
}

async function openAddItemForm(page: Page, isPhone: boolean) {
  await page.goto("/");
  await page.getByRole("button", { name: "Add item" }).click();
  return page.getByRole(isPhone ? "dialog" : "complementary", { name: "Add item" });
}

test.describe("adding items", () => {
  test("shows field errors when required fields are missing", async ({ page }, testInfo) => {
    const form = await openAddItemForm(page, testInfo.project.name === "phone");

    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form.getByText("Enter a title")).toBeVisible();
    await expect(form.getByText("Enter a whole number of minutes")).toBeVisible();
    await expect(form.getByText("Enter a date and time")).toBeVisible();
  });

  test("schedules a new flexible task", async ({ page }, testInfo) => {
    const title = `E2E homework (${testInfo.project.name})`;
    const form = await openAddItemForm(page, testInfo.project.name === "phone");

    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill("60");
    await form.getByLabel("Due").fill(localDateTime(2, "20:00"));
    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form).toBeHidden();
    // Placed on the calendar or listed under "Couldn't fit": either way it was saved and scheduled.
    await expect(page.getByText(title).first()).toBeAttached();
  });

  test("adds a fixed item at its time", async ({ page }, testInfo) => {
    const title = `E2E office hours (${testInfo.project.name})`;
    const form = await openAddItemForm(page, testInfo.project.name === "phone");

    await form.getByRole("radio", { name: "At a set time" }).click();
    await expect(form.getByLabel("Priority")).toHaveValue("mandatory");
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Starts").fill(localDateTime(0, "15:00"));
    await form.getByLabel("Ends").fill(localDateTime(0, "16:00"));
    await form.getByRole("button", { name: "Add item" }).click();

    await expect(form).toBeHidden();
    await expect(page.getByText(title)).toBeAttached();
    await expect(page.getByText("15:00–16:00").first()).toBeAttached();
  });
});
