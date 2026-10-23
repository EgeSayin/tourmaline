import { expect, test } from "@playwright/test";
import { addFixedItemToday, blockPanel, earlySlot, isPhone, openTaskLink } from "./helpers";

test.describe("block panel", () => {
  test("edits a block's item in place on desktop, and shows its details with a link to edit on phones", async ({
    page,
  }, testInfo) => {
    const title = `E2E meeting (${testInfo.project.name})`;
    const slot = earlySlot(testInfo, 6);
    await addFixedItemToday(page, testInfo, title, slot);
    const panel = blockPanel(page, testInfo);
    await page.getByRole("button", { name: `${title} ${slot.label}` }).click();

    if (isPhone(testInfo)) {
      await expect(panel.getByLabel("Title")).toHaveCount(0);
      await expect(openTaskLink(page, testInfo)).toBeVisible();
      return;
    }

    await expect(panel.getByRole("group", { name: "Event" })).toBeVisible();
    await panel.getByLabel("Title").fill(`${title} moved`);
    await panel.getByLabel("Location (optional)").fill("Room 2");
    await panel.getByRole("button", { name: "Save changes" }).click();
    await expect(panel).toBeHidden();

    await page.getByRole("button", { name: `${title} moved ${slot.label}` }).click();
    await expect(panel.getByLabel("Location (optional)")).toHaveValue("Room 2");
    await expect(openTaskLink(page, testInfo)).toBeVisible();
  });
});
