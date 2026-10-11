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

  test("on phones, shows three days from today and steps by three", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo), "larger screens step by weeks");
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    const firstRange = await heading.textContent();
    await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute("aria-disabled", "true");

    const today = Temporal.Now.plainDateISO(TIME_ZONE);
    await page.getByRole("link", { name: "Next days" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?date=${today.add({ days: 3 })}$`));
    await expect(heading).not.toHaveText(firstRange!);

    await page.getByRole("link", { name: "Previous days" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?date=${today}$`));
    await expect(heading).toHaveText(firstRange!);

    await page.getByRole("link", { name: "Next days" }).click();
    await expect(heading).not.toHaveText(firstRange!); // Today only works once we've left today
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(heading).toHaveText(firstRange!);
  });
});
