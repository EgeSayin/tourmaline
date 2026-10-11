import { expect, test } from "@playwright/test";
import { formatLocalDate } from "@/lib/time/format";
import { localDate, TIME_ZONE } from "./helpers";

test.describe("now line", () => {
  test("marks the current time on today's column only, moving as time passes", async ({ page }) => {
    const today = localDate(0);
    const noon = Temporal.PlainDateTime.from(`${today}T12:00`).toZonedDateTime(TIME_ZONE).epochMilliseconds;
    await page.clock.install({ time: noon });
    await page.goto("/");

    const now = page.getByRole("separator", { name: /^Now/ });
    await expect(now).toHaveCount(1);
    await expect(
      page
        .getByRole("group", { name: formatLocalDate(today.toString()) })
        .getByRole("separator", { name: "Now, 12:00" }),
    ).toBeVisible();

    await page.clock.runFor(30 * 60_000);
    await expect(now).toHaveAccessibleName("Now, 12:30");
  });
});
