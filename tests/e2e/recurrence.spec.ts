import { expect, test } from "@playwright/test";
import { earlySlot, isPhone, itemPanel, localDate, localDateTime, openAddItemForm, TIME_ZONE } from "./helpers";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayLabel = (days: number) => WEEKDAY_LABELS[localDate(days).dayOfWeek - 1];
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

    const form = await openAddItemForm(page, testInfo);
    await form.getByRole("radio", { name: "At a set time" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Starts").fill(localDateTime(-1, slot.start));
    await form.getByLabel("Ends").fill(localDateTime(-1, slot.end));
    await form.getByLabel("Repeat").selectOption("weekly");
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form.getByText("Choose at least one day")).toBeVisible();

    for (const days of [-1, 0, 1]) await form.getByRole("button", { name: weekdayLabel(days), exact: true }).click();
    await form.getByLabel("Until").fill(String(localDate(1)));
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
    const panel = itemPanel(page, testInfo, "Edit item");
    const ended = Temporal.PlainTime.compare(Temporal.Now.plainTimeISO(TIME_ZONE), slot.end) >= 0;
    await expect(panel.getByLabel("Starts")).toHaveValue(localDateTime(ended ? 1 : 0, slot.start));
    await expect(panel.getByLabel("Repeat")).toHaveValue("weekly");
    await expect(panel.getByLabel("Until")).toHaveValue(String(localDate(1)));
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
    await panel.getByRole("button", { name: `Skip ${dateLabel(1)}` }).click();
    await expect(panel).toBeHidden();
    await expect(tomorrows).toHaveCount(0);
  });

  test("lists each occurrence of a repeating task that can't fit by its date, and opens the series", async ({
    page,
  }, testInfo) => {
    const title = `E2E night shift (${testInfo.project.name})`;
    const form = await openAddItemForm(page, testInfo);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Duration (min)").fill(String(15 * 60)); // longer than any free stretch in a day
    await form.getByLabel("Repeat").selectOption("daily");
    await expect(form.getByLabel("Due")).toHaveCount(0);
    // From yesterday, so one occurrence always covers now.
    await form.getByLabel("Not before").fill(localDateTime(-1, "10:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await expect(form).toBeHidden();

    if (isPhone(testInfo)) await page.getByRole("button", { name: "Queue" }).click();
    const queue = page.getByRole("region", { name: "Task queue" });
    const entries = queue.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)} · \\w{3}, \\w{3} \\d+`) });
    await expect(entries.first()).toContainText("15h left");

    await entries.first().click();
    const panel = itemPanel(page, testInfo, "Edit item");
    await expect(panel.getByLabel("Repeat")).toHaveValue("daily");
    await expect(panel.getByLabel("Due")).toHaveCount(0);

    // Deleting ends the series yesterday: today's occurrence goes, while yesterday's may still be running.
    const todays = queue.getByRole("button", { name: `${title} · ${dateLabel(0)}` });
    await expect(todays).toBeVisible();
    await panel.getByRole("button", { name: "Delete" }).click();
    await panel.getByRole("button", { name: "Confirm delete" }).click();
    await expect(panel).toBeHidden();
    await expect(todays).toHaveCount(0);
  });
});
