import { expect, type Locator, test } from "@playwright/test";
import { formatTimeOfDayRange, toReading } from "@/lib/time/clock";
import { earlySlot, fillDuration, localDate, openAddItemForm, openItemForEditing } from "./helpers";

/** Types `minuteOfDay` on a 12-hour clock into the time field `label`: its hours and minutes boxes and its AM or PM. */
async function fill12h(scope: Locator, label: string, minuteOfDay: number) {
  const { hours, minutes, period } = toReading(minuteOfDay, "12h");
  await scope.getByLabel(`${label} hours`).fill(String(hours));
  await scope.getByLabel(`${label} minutes`).fill(String(minutes).padStart(2, "0"));
  await scope
    .getByRole("radiogroup", { name: `${label} AM or PM` })
    .getByRole("radio", { name: period! })
    .click();
}

test.describe("12-hour clock", () => {
  // The seeded account picks no clock, so its times follow this browser's language. Nothing is saved in settings:
  // the other specs share the account and read 24-hour times.
  test.use({ locale: "en-US" });

  test("follows the browser's language, shows times with AM and PM and takes them typed so", async ({
    page,
  }, testInfo) => {
    await page.goto("/settings");
    await expect(page.getByRole("radio", { name: "12-hour (AM/PM)" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Follows your browser's language until you save one.")).toBeVisible();
    await expect(page.getByRole("group", { name: "Mon downtime" })).toHaveText("12:00–10:00 AM, 11:00 PM–12:00 AM");

    // A fixed item typed on the 12-hour clock lands at that time.
    const title = `E2E 12-hour (${testInfo.project.name})`;
    const slot = earlySlot(testInfo, 7);
    let form = await openAddItemForm(page);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Date", { exact: true }).fill(String(localDate(0)));
    await fill12h(form, "Starts", slot.startMinute);
    await fill12h(form, "Ends", slot.startMinute + 30);
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();
    await page.goto("/");
    const label = formatTimeOfDayRange(slot.startMinute, slot.startMinute + 30, "12h");
    await expect(page.getByRole("button", { name: `${title} ${label}` })).toBeVisible();

    const editor = await openItemForEditing(page, testInfo, title);
    await expect(editor.getByLabel("Starts hours")).toHaveValue(String(toReading(slot.startMinute, "12h").hours));
    const startPeriod = editor.getByRole("radiogroup", { name: "Starts AM or PM" });
    await expect(startPeriod.getByRole("radio", { name: "AM" })).toHaveAttribute("aria-checked", "true");

    // An evening due time is sent and shown as PM.
    const task = `E2E 12-hour task (${testInfo.project.name})`;
    form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(task);
    await fillDuration(form, "Duration", 30);
    await form.getByLabel("Due date").fill(String(localDate(3)));
    await fill12h(form, "Due", 20 * 60);
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();
    await page.goto("/tasks");
    await expect(page.getByRole("link", { name: new RegExp(RegExp.escape(task)) })).toContainText(", 8:00 PM");
  });
});
