import { expect, test } from "@playwright/test";

test.describe("stats", () => {
  test("opens from the page switch, with the share of reviewed task time done and each week's, or an empty state", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Stats" }).first().click();
    const stats = page.getByRole("region", { name: "Stats" });
    await expect(stats.getByRole("heading", { name: "Stats" })).toBeVisible();
    // Early in the seeded week, no block may have ended yet.
    await expect(
      stats.getByText(/you did \d+% of the task time you reviewed|No block reviewed yet|Nothing yet/),
    ).toBeVisible();
    if (await stats.getByText("Nothing yet").isHidden()) {
      await expect(
        stats.getByRole("group", { name: "Planned task time, by week" }).getByText("This week"),
      ).toBeVisible();
    }
  });
});
