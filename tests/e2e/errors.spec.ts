import { expect, test } from "@playwright/test";
import { fillDateTime, fillDuration, localDateTime, openAddItemForm } from "./helpers";

test.describe("errors", () => {
  test("shows a page that isn't there as not found, with a way back", async ({ page }) => {
    await page.goto("/nowhere");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Go to the calendar" }).click();
    await expect(page.getByRole("region", { name: "Calendar" })).toBeVisible();
  });

  test("tells about a change that didn't go through, keeping what was entered", async ({ page }, testInfo) => {
    const title = `E2E unsaved (${testInfo.project.name})`;
    const form = await openAddItemForm(page);
    await form.getByLabel("Title").fill(title);
    await fillDuration(form, "Duration", 30);
    await fillDateTime(form, "Due", localDateTime(2, "20:00"));

    // Server actions are POSTs naming the action in a header; dropping them is a failed save.
    await page.route("**/*", (route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"]
        ? route.abort()
        : route.fallback(),
    );
    await form.getByRole("button", { name: "Add item" }).click();

    await expect(page.getByText("Couldn't save the change. Try again.")).toBeVisible();
    await expect(form.getByLabel("Title")).toHaveValue(title);
  });
});
