import { expect, test } from "@playwright/test";
import { isPhone, TIME_ZONE } from "./helpers";

test.describe("calendar navigation", () => {
  test("steps through weeks and back to this week", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo), "phones step by days");
    await page.goto("/");
    const label = (text: string) => page.getByText(text, { exact: true });
    await expect(label("This week")).toBeVisible();
    await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("link", { name: "Next week" }).click();
    await expect(label("Next week")).toBeVisible();
    await expect(page).toHaveURL(/\?date=\d{4}-\d{2}-\d{2}$/);

    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(label("This week")).toBeVisible(); // the second click must start from here
    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(label("Last week")).toBeVisible();

    await page.getByRole("link", { name: "Today" }).click();
    await expect(label("This week")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("on phones, shows three days from today, labelled only then, and steps by three", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo), "larger screens step by weeks");
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    const firstRange = await heading.textContent();
    const todayLabel = page.getByText("Today", { exact: true }).and(page.locator("p"));
    await expect(todayLabel).toBeVisible();
    await expect(page.getByText(/week/)).toBeHidden();
    await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute("aria-disabled", "true");

    const today = Temporal.Now.plainDateISO(TIME_ZONE);
    await page.getByRole("link", { name: "Next days" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?date=${today.add({ days: 3 })}$`));
    await expect(heading).not.toHaveText(firstRange!);
    await expect(todayLabel).toHaveCount(0);

    await page.getByRole("link", { name: "Previous days" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?date=${today}$`));
    await expect(heading).toHaveText(firstRange!);

    await page.getByRole("link", { name: "Next days" }).click();
    await expect(heading).not.toHaveText(firstRange!); // Today only works once we've left today
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(heading).toHaveText(firstRange!);
  });

  test("on phones, switches pages and the lists from the bottom bar, keeping the shown days", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhone(testInfo), "larger screens switch pages in the header");
    const tomorrow = Temporal.Now.plainDateISO(TIME_ZONE).add({ days: 1 });
    await page.goto(`/?date=${tomorrow}`);
    const bar = page.getByRole("navigation", { name: "Views" });
    const calendar = bar.getByRole("link", { name: "Calendar" });

    await bar.getByRole("button", { name: /^Lists/ }).click();
    await expect(page.getByRole("radiogroup", { name: "Lists" })).toBeVisible();
    await expect(calendar).not.toHaveAttribute("aria-current");
    await calendar.click();
    await expect(page.getByRole("region", { name: "Calendar" })).toBeVisible();
    await expect(calendar).toHaveAttribute("aria-current", "page");
    // Any navigation would be a fetch; none must start.
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`\\?date=${tomorrow}$`));

    await bar.getByRole("link", { name: "Tasks" }).click();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  });
});
