import { expect, type Page, test } from "@playwright/test";

/** Moves the mouse to `time` ("HH:MM", the middle of its half hour) on a day of the settings calendar. */
async function pointAt(page: Page, day: string, time: string) {
  const box = (await page.getByRole("group", { name: `${day} downtime` }).boundingBox())!;
  const [hours, minutes] = time.split(":").map(Number);
  await page.mouse.move(box.x + box.width / 2, box.y + ((hours * 60 + minutes + 15) / (24 * 60)) * box.height);
}

test.describe("settings", () => {
  // Nothing is saved here: saving plans every movable block again, under other tests' feet.
  test("shows the seeded caps and downtime, and paints and clears downtime by dragging", async ({ page }) => {
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
    await expect(settings.getByLabel("Time zone")).toHaveValue("America/New_York");
    await expect(settings.getByLabel("Mon", { exact: true })).toHaveValue("8h");
    await expect(settings.getByLabel("Sun", { exact: true })).toHaveValue("4h");
    const monday = settings.getByRole("group", { name: "Mon downtime" });
    const tuesday = settings.getByRole("group", { name: "Tue downtime" });
    await expect(monday).toHaveText("00:00–10:00, 23:00–24:00");
    await monday.evaluate((column) => column.scrollIntoView({ block: "center" }));

    // A drag paints the rectangle from Monday 12:00 to Tuesday 13:00's half hour.
    await pointAt(page, "Mon", "12:00");
    await page.mouse.down();
    await pointAt(page, "Tue", "13:00");
    await page.mouse.up();
    await expect(monday).toHaveText("00:00–10:00, 12:00–13:30, 23:00–24:00");
    await expect(tuesday).toHaveText("00:00–10:00, 12:00–13:30, 23:00–24:00");

    // Starting on painted time clears instead.
    await pointAt(page, "Mon", "12:00");
    await page.mouse.down();
    await page.mouse.up();
    await expect(monday).toHaveText("00:00–10:00, 12:30–13:30, 23:00–24:00");

    // A cap longer than a day is turned back, and nothing is saved.
    await settings.getByLabel("Mon", { exact: true }).fill("25h");
    await settings.getByRole("button", { name: "Save", exact: true }).click();
    await expect(settings.getByText("Enter up to 24h")).toBeVisible();
    await expect(settings.getByRole("status")).toHaveCount(0);
  });
});
