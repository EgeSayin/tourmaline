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

/** The add/edit panel: docked beside the calendar on desktop, a bottom sheet on phones. */
export function itemPanel(page: Page, testInfo: TestInfo, name: "Add item" | "Edit item") {
  return page.getByRole(isPhone(testInfo) ? "dialog" : "complementary", { name });
}

export async function openAddItemForm(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  await page.getByRole("button", { name: "Add item" }).click();
  return itemPanel(page, testInfo, "Add item");
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
  const form = await openAddItemForm(page, testInfo);
  await form.getByRole("radio", { name: "At a set time" }).click();
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Starts").fill(localDateTime(0, slot.start));
  await form.getByLabel("Ends").fill(localDateTime(0, slot.end));
  await form.getByRole("button", { name: "Add item" }).click();
  await expect(form).toBeHidden();
}

export async function openItemForEditing(page: Page, testInfo: TestInfo, title: string) {
  await page.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)}`) }).click();
  return itemPanel(page, testInfo, "Edit item");
}
