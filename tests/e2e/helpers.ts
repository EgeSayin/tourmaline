import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { toTimeInputValue } from "@/lib/time/time-of-day";

/** The account the specs sign in as; global setup seeds it with the sample week. */
export const E2E_ACCOUNT = { username: "e2e", password: "e2e-password" };

/** Where the setup project keeps the account's signed-in session for the other projects. */
export const SIGNED_IN_STATE = "playwright/.auth/e2e.json";

// Matches the seeded settings.
export const TIME_ZONE = "America/New_York";

export const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";

/** The local date `days` from today, in the seeded time zone. */
export function localDate(days: number): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(TIME_ZONE).add({ days });
}

/** A local `datetime-local` value `days` from today, in the seeded time zone. */
export function localDateTime(days: number, time: string): string {
  return `${localDate(days)}T${time}`;
}

/** The calendar's block panel: docked beside the calendar on desktop, a bottom sheet on phones. */
export function blockPanel(page: Page, testInfo: TestInfo) {
  return page.getByRole(isPhone(testInfo) ? "dialog" : "complementary", { name: "Block" });
}

/** The block panel's link to the tasks page: "Open task" beside its fields on desktop, "Edit" on phones. */
export function openTaskLink(page: Page, testInfo: TestInfo) {
  return blockPanel(page, testInfo).getByRole("link", { name: isPhone(testInfo) ? "Edit" : "Open task", exact: true });
}

/** The tasks page's editor for an existing item. */
export function itemEditor(page: Page) {
  return page.getByRole("complementary", { name: "Edit item" });
}

/** Opens the new item form on the tasks page through the toolbar's Add item, from the calendar. */
export async function openAddItemForm(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Add item" }).click();
  return page.getByRole("complementary", { name: "New item" });
}

/**
 * A 30-minute slot early today, unique per `slot` and project. Tests run in parallel against one database,
 * so overlapping items would cover each other's blocks; seeded items never use these hours.
 */
export function earlySlot(testInfo: TestInfo, slot: number) {
  const startMinute = 60 + (slot * 2 + (isPhone(testInfo) ? 1 : 0)) * 30;
  const [start, end] = [toTimeInputValue(startMinute), toTimeInputValue(startMinute + 30)];
  return { startMinute, start, end, label: `${start}–${end}` };
}

/** Adds a fixed item today in `slot` through the form. */
export async function addFixedItemToday(
  page: Page,
  testInfo: TestInfo,
  title: string,
  slot: { start: string; end: string },
) {
  const form = await openAddItemForm(page);
  await form.getByRole("radio", { name: "At a set time" }).click();
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Date", { exact: true }).fill(String(localDate(0)));
  await fillTime(form, "Starts", slot.start);
  await fillTime(form, "Ends", slot.end);
  await form.getByRole("button", { name: "Add item" }).click();
  await expect(form).toBeHidden();
  await page.goto("/");
}

/** Opens the item of the calendar block titled `title` in the editor, through its block panel. */
export async function openItemForEditing(page: Page, testInfo: TestInfo, title: string) {
  await page.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)}`) }).click();
  await openTaskLink(page, testInfo).click();
  return itemEditor(page);
}

/** Shows the calendar's task queue: the lists' Queue tab, behind the bottom Lists tab on phones. */
export async function showQueue(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  if (isPhone(testInfo)) {
    await page
      .getByRole("navigation", { name: "Views" })
      .getByRole("button", { name: /^Lists/ })
      .click();
  }
  await page
    .getByRole("radiogroup", { name: "Lists" })
    .getByRole("radio", { name: /^Queue/ })
    .click();
  return page.getByRole("region", { name: "Task queue" });
}

/** Types `minutes` into the hours and minutes boxes of the duration field `label`. */
export async function fillDuration(scope: Locator, label: string, minutes: number) {
  await scope.getByLabel(`${label} hours`).fill(String(Math.floor(minutes / 60)));
  await scope.getByLabel(`${label} minutes`).fill(String(minutes % 60));
}

export async function expectDuration(scope: Locator, label: string, minutes: number) {
  await expect(scope.getByLabel(`${label} hours`)).toHaveValue(String(Math.floor(minutes / 60)));
  await expect(scope.getByLabel(`${label} minutes`)).toHaveValue(String(minutes % 60));
}

/** Types `time`, like "09:30", into the hours and minutes boxes of the time field `label`. */
export async function fillTime(scope: Locator, label: string, time: string) {
  const [hours, minutes] = time.split(":");
  await scope.getByLabel(`${label} hours`).fill(hours);
  await scope.getByLabel(`${label} minutes`).fill(minutes);
}

export async function expectTime(scope: Locator, label: string, time: string) {
  const [hours, minutes] = time.split(":");
  await expect(scope.getByLabel(`${label} hours`)).toHaveValue(hours);
  await expect(scope.getByLabel(`${label} minutes`)).toHaveValue(minutes);
}

/** Fills the date and time field `label` with `dateTime`, like "2026-10-08T20:00". */
export async function fillDateTime(scope: Locator, label: string, dateTime: string) {
  await scope.getByLabel(`${label} date`).fill(dateTime.slice(0, 10));
  await fillTime(scope, label, dateTime.slice(11, 16));
}
