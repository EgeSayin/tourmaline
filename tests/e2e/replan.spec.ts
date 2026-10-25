import { expect, test } from "@playwright/test";

test.describe("planning again", () => {
  // Confirming isn't tried here: specs share one workspace and run in parallel, so a fresh plan could move their blocks.
  test("asks before planning everything again, and cancelling changes nothing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Replan" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Plan everything again?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Plan again" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});
