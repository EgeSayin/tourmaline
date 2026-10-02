import { expect, test } from "@playwright/test";

test.describe("week navigation", () => {
  test("steps through weeks and back to this week", async ({ page }) => {
    await page.goto("/");
    const label = (text: string) => page.getByText(text, { exact: true });
    await expect(label("This week")).toBeVisible();
    await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("link", { name: "Next week" }).click();
    await expect(label("Next week")).toBeVisible();
    await expect(page).toHaveURL(/\?week=\d{4}-\d{2}-\d{2}$/);

    await page.getByRole("link", { name: "Previous week" }).click();
    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(label("Last week")).toBeVisible();

    await page.getByRole("link", { name: "Today" }).click();
    await expect(label("This week")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
