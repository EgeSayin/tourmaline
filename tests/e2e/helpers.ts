import { expect, type Page, type TestInfo } from "@playwright/test";
import { toTimeInputValue } from "@/lib/time/time-of-day";

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

/** The calendar's edit panel: docked beside the calendar on desktop, a bottom sheet on phones. */
export function itemPanel(page: Page, testInfo: TestInfo, name: "Edit item") {
  return page.getByRole(isPhone(testInfo) ? "dialog" : "complementary", { name });
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
  await form.getByLabel("Starts").fill(localDateTime(0, slot.start));
  await form.getByLabel("Ends").fill(localDateTime(0, slot.end));
  await form.getByRole("button", { name: "Add item" }).click();
  await expect(form).toBeHidden();
  await page.goto("/");
}

export async function openItemForEditing(page: Page, testInfo: TestInfo, title: string) {
  await page.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)}`) }).click();
  return itemPanel(page, testInfo, "Edit item");
}

/** Shows the calendar's task queue: the lists' Queue tab, behind the bottom tab on phones. */
export async function showQueue(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  const tab = (group: string) => page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: /^Queue/ });
  if (isPhone(testInfo)) await tab("View").click();
  await tab("Lists").click();
  return page.getByRole("region", { name: "Task queue" });
}
