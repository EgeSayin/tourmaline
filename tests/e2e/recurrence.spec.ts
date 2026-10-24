import { expect, test } from "@playwright/test";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import {
  blockPanel,
  earlySlot,
  expectDuration,
  expectTime,
  fillDateTime,
  fillDuration,
  fillTime,
  itemEditor,
  localDate,
  localDateTime,
  openAddItemForm,
  openTaskLink,
  showQueue,
} from "./helpers";

const weekdayLabel = (days: number) => WEEKDAY_NAMES[localDate(days).dayOfWeek - 1];
/** As queue entries show a date, e.g. "Wed, Oct 7". */
const dateLabel = (days: number) =>
  localDate(days).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });

test.describe("recurring items", () => {
  test("repeats a fixed item on its chosen days until its end date, and edits it from an occurrence on", async ({
    page,
  }, testInfo) => {
    const title = `E2E standup (${testInfo.project.name})`;
    const slot = earlySlot(testInfo, 3);
    const block = page.getByRole("button", { name: `${title} ${slot.label}` });

    const form = await openAddItemForm(page);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("How often").selectOption("weekly");
    await form.getByLabel("First date", { exact: true }).fill(String(localDate(-1)));
    await fillTime(form, "Starts", slot.start);
    await fillTime(form, "Ends", slot.end);
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form.getByText("Choose at least one day")).toBeVisible();

    for (const days of [-1, 0, 1]) await form.getByRole("button", { name: weekdayLabel(days), exact: true }).click();
    await form.getByLabel("Until", { exact: true }).fill(String(localDate(1)));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    await page.goto(`/?date=${localDate(1)}`);
    await expect(block.first()).toBeVisible();
    // The week containing today + 8 starts after the end date, and so do the three days from it.
    await page.goto(`/?date=${localDate(8)}`);
    await expect(page.getByRole("heading", { name: /\d/ }).first()).toBeVisible();
    await expect(block).toHaveCount(0);

    // Opens the series at today's occurrence, to edit from it on.
    await page.goto("/");
    await page
      .getByRole("group", { name: dateLabel(0) })
      .getByRole("button", { name: `${title} ${slot.label}` })
      .click();
    await openTaskLink(page, testInfo).click();
    const panel = itemEditor(page);
    await panel.getByRole("radio", { name: "This and later ones" }).click();
    await expect(panel.getByLabel("How often")).toHaveValue("weekly");
    await expect(panel.getByLabel("First date", { exact: true })).toHaveValue(String(localDate(0)));
    await expectTime(panel, "Starts", slot.start);
    await expect(panel.getByLabel("Until", { exact: true })).toHaveValue(String(localDate(1)));
    await expect(panel.getByRole("button", { name: weekdayLabel(0), exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Saved from today's on, so yesterday's keeps the old title and tomorrow's has the new one.
    await panel.getByLabel("Title").fill(`${title} moved`);
    await panel.getByRole("button", { name: "Save changes" }).click();
    await expect(panel).toBeHidden();
    const renamedLabel = `${title} moved ${slot.label}`;
    const renamed = page.getByRole("button", { name: renamedLabel });
    await page.goto(`/?date=${localDate(-1)}`);
    await expect(block.first()).toBeVisible();
    await page.goto(`/?date=${localDate(1)}`);
    await expect(renamed.first()).toBeVisible();

    const tomorrows = page.getByRole("group", { name: dateLabel(1) }).getByRole("button", { name: renamedLabel });
    await tomorrows.click();
    const blockActions = blockPanel(page, testInfo);
    await blockActions.getByRole("button", { name: `Skip ${dateLabel(1)}` }).click();
    await expect(blockActions).toBeHidden();
    await expect(tomorrows).toHaveCount(0);
  });

  test("gives each day of a weekly fixed item its own times", async ({ page }, testInfo) => {
    const title = `E2E seminar (${testInfo.project.name})`;
    const [todaySlot, tomorrowSlot] = [earlySlot(testInfo, 6), earlySlot(testInfo, 7)];
    const [today, tomorrow] = [weekdayLabel(0), weekdayLabel(1)];
    const inDay = (days: number, label: string) =>
      page.getByRole("group", { name: dateLabel(days) }).getByRole("button", { name: `${title} ${label}` });

    const form = await openAddItemForm(page);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("How often").selectOption("weekly");
    await form.getByRole("button", { name: today, exact: true }).click();
    await expect(form.getByRole("radio", { name: "Different each day" })).toBeHidden();
    await form.getByRole("button", { name: tomorrow, exact: true }).click();
    await form.getByRole("radio", { name: "Different each day" }).click();
    await expect(form.getByLabel("Starts hours", { exact: true })).toHaveCount(0);
    await form.getByLabel("First date", { exact: true }).fill(String(localDate(0)));
    await fillTime(form, `${today} starts`, todaySlot.start);
    await fillTime(form, `${today} ends`, todaySlot.end);
    await fillTime(form, `${tomorrow} starts`, tomorrowSlot.start);
    await fillTime(form, `${tomorrow} ends`, tomorrowSlot.end);
    await form.getByLabel("Until", { exact: true }).fill(String(localDate(1)));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    // Each day is opened by its own date: on desktop, today and tomorrow can fall in different weeks.
    await page.goto(`/?date=${localDate(0)}`);
    await expect(inDay(0, todaySlot.label)).toBeVisible();
    await page.goto(`/?date=${localDate(1)}`);
    await expect(inDay(1, tomorrowSlot.label)).toBeVisible();
    await expect(inDay(1, todaySlot.label)).toHaveCount(0);

    await inDay(1, tomorrowSlot.label).click();
    await openTaskLink(page, testInfo).click();
    const editor = itemEditor(page);
    await editor.getByRole("radio", { name: "This and later ones" }).click();
    await expect(editor.getByRole("radio", { name: "Different each day" })).toHaveAttribute("aria-checked", "true");
    await expectTime(editor, `${today} starts`, todaySlot.start);
    await expectTime(editor, `${tomorrow} ends`, tomorrowSlot.end);
  });

  test("takes only what fits of a repeating task, never queueing it, and stops it after a total", async ({
    page,
  }, testInfo) => {
    const title = `E2E side project (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("How often").selectOption("daily");
    await expect(form.getByLabel("Duration hours")).toBeVisible();
    await form.getByRole("radio", { name: "Only spare time" }).click();
    // The most it gets each day, kept to its own day.
    await fillDuration(form, "At most per day", 15 * 60); // longer than any free stretch in a day
    await expect(form.getByRole("radio", { name: "Same day only" })).toHaveCount(0);
    await fillDuration(form, "Stop after a total of", 300 * 60);
    await fillDateTime(form, "Not before", localDateTime(-1, "10:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    const queue = await showQueue(page, testInfo);
    await expect(queue.getByRole("link", { name: new RegExp(RegExp.escape(title)) })).toHaveCount(0);

    await page.goto("/tasks");
    const row = page.getByRole("link", { name: new RegExp(RegExp.escape(title)) });
    await expect(row).toContainText("0m of 300h done");
    await row.click();
    const editor = itemEditor(page);
    await expect(editor.getByRole("radio", { name: "Only spare time" })).toHaveAttribute("aria-checked", "true");
    await expectDuration(editor, "At most per day", 15 * 60);
    await expectDuration(editor, "Stop after a total of", 300 * 60);
  });

  test("lists each occurrence of a repeating task that can't fit by its date, and opens the series to mark one done", async ({
    page,
  }, testInfo) => {
    const title = `E2E night shift (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await fillDuration(form, "Duration", 15 * 60); // longer than any free stretch in a day
    await form.getByLabel("How often").selectOption("daily");
    await expect(form.getByLabel("Due")).toHaveCount(0);
    await form.getByRole("radio", { name: "Same day only" }).click();
    // From yesterday, so one occurrence always covers now.
    await fillDateTime(form, "Not before", localDateTime(-1, "10:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    const queue = await showQueue(page, testInfo);
    const entries = queue.getByRole("link", { name: new RegExp(`^${RegExp.escape(title)} · \\w{3}, \\w{3} \\d+`) });
    await expect(entries.first()).toContainText("15h left");

    // Kept within its day: yesterday's is over, and deleting ends the series yesterday, so today's goes.
    const todays = queue.getByRole("link", { name: `${title} · ${dateLabel(0)}` });
    await expect(todays).toBeVisible();
    await expect(queue.getByRole("link", { name: `${title} · ${dateLabel(-1)}` })).toHaveCount(0);

    // Opens at the occurrence, with the series a switch away.
    await entries.first().click();
    const panel = itemEditor(page);
    await panel.getByRole("radio", { name: "This and later ones" }).click();
    await expect(panel.getByLabel("How often")).toHaveValue("daily");
    await expect(panel.getByLabel("Due")).toHaveCount(0);
    await expect(panel.getByRole("radio", { name: "Same day only" })).toHaveAttribute("aria-checked", "true");

    // Its editor lists today's occurrence, which can be marked done on its own and reopened.
    const todaysOccurrence = panel
      .getByRole("group", { name: "Next occurrences" })
      .getByRole("listitem", { name: dateLabel(0) });
    const markDone = todaysOccurrence.getByRole("button", { name: `Mark ${dateLabel(0)} done` });
    const reopen = todaysOccurrence.getByRole("button", { name: `Reopen ${dateLabel(0)}` });
    // The card shows the date, so its buttons leave it out.
    await expect(markDone).toHaveText("Mark done");
    await expect(todaysOccurrence.getByRole("button", { name: `Skip ${dateLabel(0)}` })).toHaveText("Skip");
    await markDone.click();
    await expect(reopen).toBeVisible();
    await showQueue(page, testInfo);
    await expect(entries.first()).toBeVisible();
    await expect(todays).toHaveCount(0);

    await entries.first().click();
    await reopen.click();
    await expect(markDone).toBeVisible();
    await showQueue(page, testInfo);
    await expect(todays).toBeVisible();

    await entries.first().click();
    await panel.getByRole("radio", { name: "This and later ones" }).click();
    await panel.getByRole("button", { name: "Delete" }).click();
    await panel.getByRole("button", { name: "Confirm delete" }).click();
    await expect(panel).toBeHidden();
    await showQueue(page, testInfo);
    await expect(todays).toHaveCount(0);
  });

  test("moves one occurrence of a series alone, and resets it to the series", async ({ page }, testInfo) => {
    const title = `E2E daily check-in (${testInfo.project.name})`;
    const [slot, later] = [earlySlot(testInfo, 4), earlySlot(testInfo, 5)];
    const inDay = (days: number, label: string) =>
      page.getByRole("group", { name: dateLabel(days) }).getByRole("button", { name: `${title} ${label}` });

    const form = await openAddItemForm(page);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("How often").selectOption("daily");
    await form.getByLabel("First date", { exact: true }).fill(String(localDate(0)));
    await fillTime(form, "Starts", slot.start);
    await fillTime(form, "Ends", slot.end);
    await form.getByLabel("Until", { exact: true }).fill(String(localDate(2)));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    await page.goto(`/?date=${localDate(1)}`);
    await inDay(1, slot.label).click();
    await openTaskLink(page, testInfo).click();
    const editor = itemEditor(page);
    await expect(editor.getByText(`The occurrence on ${dateLabel(1)}`)).toBeVisible();
    await expect(editor.getByRole("radio", { name: "Only this one" })).toHaveAttribute("aria-checked", "true");
    await fillTime(editor, "Starts", later.start);
    await expectTime(editor, "Ends", later.end);
    await editor.getByRole("button", { name: "Save this occurrence" }).click();
    await expect(editor).toBeHidden();

    // Each day is opened by its own date: on desktop, tomorrow and the day after can fall in different weeks.
    await page.goto(`/?date=${localDate(2)}`);
    await expect(inDay(2, slot.label)).toBeVisible();
    await page.goto(`/?date=${localDate(1)}`);
    await expect(inDay(1, later.label)).toBeVisible();
    await expect(inDay(1, slot.label)).toHaveCount(0);

    await inDay(1, later.label).click();
    await openTaskLink(page, testInfo).click();
    await expect(editor.getByText("Changed from the series.")).toBeVisible();
    await editor.getByRole("button", { name: "Reset to the series" }).click();
    await expect(editor).toBeHidden();
    await page.goto(`/?date=${localDate(1)}`);
    await expect(inDay(1, slot.label)).toBeVisible();
  });
});
