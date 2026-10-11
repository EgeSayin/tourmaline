import { expect, type Page, test } from "@playwright/test";
import { earlySlot, localDate, localDateTime, openAddItemForm, showQueue } from "./helpers";

/** Fills the new item form with a fixed item tomorrow in `slot` and submits it; returns the form. */
async function submitFixedItem(
  page: Page,
  title: string,
  slot: { start: string; end: string },
  priority: "Mandatory" | "Normal",
) {
  const form = await openAddItemForm(page);
  await form.getByRole("radio", { name: "At a set time" }).click();
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Priority").selectOption({ label: priority });
  await form.getByLabel("Starts").fill(localDateTime(1, slot.start));
  await form.getByLabel("Ends").fill(localDateTime(1, slot.end));
  await form.getByRole("button", { name: "Add item" }).click();
  return form;
}

const block = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`^${RegExp.escape(title)} \\d`) });

test.describe("clashes", () => {
  test("bumps an optional item into the queue, and restores it beside the item that bumped it", async ({
    page,
  }, testInfo) => {
    const slot = earlySlot(testInfo, 4);
    const club = `E2E club (${testInfo.project.name})`;
    const talk = `E2E talk (${testInfo.project.name})`;
    await expect(await submitFixedItem(page, club, slot, "Normal")).toBeHidden();

    const form = await submitFixedItem(page, talk, slot, "Mandatory");
    const clashes = form.getByRole("region", { name: "Clashes" });
    await expect(clashes).toContainText(club);
    await expect(clashes).toContainText("Optional");
    await clashes.getByRole("button", { name: "Bump and save" }).click();
    await expect(form).toBeHidden();

    await page.goto(`/?date=${localDate(1)}`);
    await expect(block(page, talk)).toBeVisible();
    await expect(block(page, club)).toHaveCount(0);

    const queue = await showQueue(page, testInfo);
    await expect(queue.getByRole("link", { name: new RegExp(`^${RegExp.escape(club)}`) })).toContainText(
      `Bumped · ${slot.label}`,
    );
    await queue.getByRole("button", { name: `Restore ${club}` }).click();
    await expect(queue.getByText(club)).toHaveCount(0);

    await page.goto(`/?date=${localDate(1)}`);
    const [clubBox, talkBox] = [await block(page, club).boundingBox(), await block(page, talk).boundingBox()];
    expect(clubBox!.y).toBe(talkBox!.y);
    expect(Math.abs(clubBox!.x - talkBox!.x)).toBeGreaterThanOrEqual(clubBox!.width);
  });

  test("warns about a mandatory clash: Cancel goes back to the form, Save anyway saves", async ({ page }, testInfo) => {
    const slot = earlySlot(testInfo, 5);
    const lab = `E2E lab (${testInfo.project.name})`;
    const call = `E2E call (${testInfo.project.name})`;
    await expect(await submitFixedItem(page, lab, slot, "Mandatory")).toBeHidden();

    const form = await submitFixedItem(page, call, slot, "Normal");
    const clashes = form.getByRole("region", { name: "Clashes" });
    await expect(clashes).toContainText(lab);
    await expect(clashes).toContainText("Mandatory");
    await expect(clashes.getByRole("button", { name: "Bump and save" })).toHaveCount(0);

    await clashes.getByRole("button", { name: "Cancel" }).click();
    await expect(clashes).toBeHidden();
    await form.getByRole("button", { name: "Add item" }).click();
    await clashes.getByRole("button", { name: "Save anyway" }).click();
    await expect(form).toBeHidden();

    await page.goto(`/?date=${localDate(1)}`);
    await expect(block(page, lab)).toBeVisible();
    await expect(block(page, call)).toBeVisible();
  });
});
