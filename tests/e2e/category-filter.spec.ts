import { expect, test } from "@playwright/test";

test.describe("category filter", () => {
  test("shows one category's items on the task list and dims the rest on the calendar, across pages", async ({
    page,
  }) => {
    await page.goto("/tasks");
    const list = page.getByRole("region", { name: "Task list" });
    await list.getByRole("radio", { name: "All" }).click();
    await list.getByLabel("Category filter").selectOption({ label: "Calculus" });
    await expect(list.getByRole("link", { name: /^Calculus problem set/ })).toBeVisible();
    await expect(list.getByRole("link", { name: /^Calculus lecture/ })).toBeVisible();
    await expect(list.getByRole("link", { name: /^Lunch/ })).toHaveCount(0);

    // Lunch happens daily, so it's on every page of the calendar; calculus blocks may not be.
    await page.getByRole("link", { name: "Calendar" }).click();
    const calendar = page.getByRole("region", { name: "Calendar" });
    await expect(calendar.getByLabel("Category filter")).toHaveValue(/[0-9a-f-]{36}/);
    const lunches = calendar.getByRole("button", { name: /^Lunch / });
    await expect(lunches.first()).toHaveAttribute("data-filtered-out", "true");
    for (const block of await calendar.getByRole("button", { name: /^Calculus / }).all()) {
      await expect(block).not.toHaveAttribute("data-filtered-out");
    }

    await calendar.getByLabel("Category filter").selectOption({ label: "All categories" });
    await expect(lunches.first()).not.toHaveAttribute("data-filtered-out");
  });
});
