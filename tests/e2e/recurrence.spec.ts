import { expect, test } from "@playwright/test";
import { WEEKDAY_NAMES } from "@/lib/time/format";
import {
  blockPanel,
  earlySlot,
  itemEditor,
  localDate,
  localDateTime,
  openAddItemForm,
  TIME_ZONE,
  showQueue,
} from "./helpers";

const weekdayLabel = (days: number) => WEEKDAY_NAMES[localDate(days).dayOfWeek - 1];
/** As queue entries show a date, e.g. "Wed, Oct 7". */
const dateLabel = (days: number) =>
  localDate(days).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });

test.describe("recurring items", () => {
  test("repeats a fixed item on its chosen days until its end date, and edits it from its next occurrence on", async ({
    page,
  }, testInfo) => {
    const title = `E2E standup (${testInfo.project.name})`;
    const slot = earlySlot(testInfo, 3);
    const block = page.getByRole("button", { name: `${title} ${slot.label}` });

    const form = await openAddItemForm(page);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Date", { exact: true }).fill(String(localDate(-1)));
    await form.getByLabel("Starts").fill(slot.start);
    await form.getByLabel("Ends").fill(slot.end);
    await form.getByLabel("How often").selectOption("weekly");
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

    // Opens the series at its next occurrence: today's, unless it has already ended.
    await page.goto("/");
    await block.first().click();
    await blockPanel(page, testInfo).getByRole("link", { name: "Open task" }).click();
    const panel = itemEditor(page);
    const ended = Temporal.PlainTime.compare(Temporal.Now.plainTimeISO(TIME_ZONE), slot.end) >= 0;
    await expect(panel.getByLabel("Date", { exact: true })).toHaveValue(String(localDate(ended ? 1 : 0)));
    await expect(panel.getByLabel("Starts")).toHaveValue(slot.start);
    await expect(panel.getByLabel("How often")).toHaveValue("weekly");
    await expect(panel.getByLabel("Until", { exact: true })).toHaveValue(String(localDate(1)));
    await expect(panel.getByRole("button", { name: weekdayLabel(0), exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Saved from the next occurrence on, so yesterday's keeps the old title and tomorrow's has the new one.
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

  test("lists each occurrence of a repeating task that can't fit by its date, and opens the series to mark one done", async ({
    page,
  }, testInfo) => {
    const title = `E2E night shift (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration", { exact: true }).fill(String(15 * 60)); // longer than any free stretch in a day
    await form.getByLabel("How often").selectOption("daily");
    await expect(form.getByLabel("Due")).toHaveCount(0);
    await form.getByRole("radio", { name: "Same day only" }).click();
    // From yesterday, so one occurrence always covers now.
    await form.getByLabel("Not before", { exact: true }).fill(localDateTime(-1, "10:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    const queue = await showQueue(page, testInfo);
    const entries = queue.getByRole("link", { name: new RegExp(`^${RegExp.escape(title)} · \\w{3}, \\w{3} \\d+`) });
    await expect(entries.first()).toContainText("15h left");

    // Kept within its day: yesterday's is over, and deleting ends the series yesterday, so today's goes.
    const todays = queue.getByRole("link", { name: `${title} · ${dateLabel(0)}` });
    await expect(todays).toBeVisible();
    await expect(queue.getByRole("link", { name: `${title} · ${dateLabel(-1)}` })).toHaveCount(0);

    await entries.first().click();
    const panel = itemEditor(page);
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
    await panel.getByRole("button", { name: "Delete" }).click();
    await panel.getByRole("button", { name: "Confirm delete" }).click();
    await expect(panel).toBeHidden();
    await showQueue(page, testInfo);
    await expect(todays).toHaveCount(0);
  });
});
