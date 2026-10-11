import { expect, test } from "@playwright/test";

test.describe("settings", () => {
  // Only invalid caps are saved here: saving valid ones plans every movable block again, under other tests' feet.
  test("shows each day's load against the seeded caps, and opens the caps from the header gear", async ({ page }) => {
    await page.goto("/");
    // The demo caps weekdays at 8h and weekends at 4h.
    await expect(
      page
        .getByText(/^\d+(h|m)( \d+m)? \/ (8h|4h)/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    const settings = page.getByRole("region", { name: "Settings" });
    await expect(settings.getByLabel("Mon")).toHaveValue("8");
    await expect(settings.getByLabel("Sun")).toHaveValue("4");

    // The browser holds back a cap longer than a day.
    await settings.getByLabel("Mon").fill("25");
    await settings.getByRole("button", { name: "Save" }).click();
    expect(await settings.getByLabel("Mon").evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(
      true,
    );
    await expect(settings.getByRole("status")).toHaveCount(0);
  });
});
