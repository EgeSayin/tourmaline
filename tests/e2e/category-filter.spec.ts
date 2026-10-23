import { expect, test } from "@playwright/test";
import { isPhone } from "./helpers";

test.describe("shown categories", () => {
  test("hides a category's items on the task list and dims them on the calendar, kept across pages and reloads", async ({
    page,
  }, testInfo) => {
    // What's shown is saved to the account: projects running at once would change it under each other.
    test.skip(isPhone(testInfo), "Covered on desktop");

    await page.goto("/tasks");
    const list = page.getByRole("region", { name: "Task list" });
    await list.getByRole("radio", { name: "All" }).click();
    const chips = list.getByRole("group", { name: "Shown categories" });
    await chips.getByRole("button", { name: "Calculus" }).click();
    await expect(chips.getByRole("button", { name: "Calculus" })).toHaveAttribute("aria-pressed", "false");
    await expect(chips.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    await expect(list.getByRole("link", { name: /^Calculus problem set/ })).toHaveCount(0);
    await expect(list.getByRole("link", { name: /^Lunch/ })).toBeVisible();

    // Lunch happens daily, so it's on every page of the calendar; calculus blocks may not be.
    // A fresh load: the choice was saved.
    await page.goto("/");
    const calendar = page.getByRole("region", { name: "Calendar" });
    const calendarChips = page.getByRole("group", { name: "Shown categories" });
    await expect(calendarChips.getByRole("button", { name: "Calculus" })).toHaveAttribute("aria-pressed", "false");
    await expect(calendar.getByRole("button", { name: /^Lunch / }).first()).not.toHaveAttribute("data-filtered-out");
    for (const block of await calendar.getByRole("button", { name: /^Calculus / }).all()) {
      await expect(block).toHaveAttribute("data-filtered-out", "true");
    }

    await calendarChips.getByRole("button", { name: "All" }).click();
    await expect(calendarChips.getByRole("button", { name: "Calculus" })).toHaveAttribute("aria-pressed", "true");
    for (const block of await calendar.getByRole("button", { name: /^Calculus / }).all()) {
      await expect(block).not.toHaveAttribute("data-filtered-out");
    }
  });
});
