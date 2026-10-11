import { expect, test } from "@playwright/test";
import { addFixedItemToday, earlySlot } from "./helpers";

test.describe("conflicts", () => {
  test("saves a fixed item over another without asking, and shows both side by side as conflicts", async ({
    page,
  }, testInfo) => {
    const slot = earlySlot(testInfo, 4);
    const lab = `E2E lab (${testInfo.project.name})`;
    const call = `E2E call (${testInfo.project.name})`;
    await addFixedItemToday(page, testInfo, lab, slot);
    await addFixedItemToday(page, testInfo, call, slot);

    const [labBlock, callBlock] = [lab, call].map((title) =>
      page.getByRole("button", { name: `${title} ${slot.label} (conflict)` }),
    );
    await expect(labBlock).toBeVisible();
    await expect(callBlock).toBeVisible();
    const [labBox, callBox] = [await labBlock.boundingBox(), await callBlock.boundingBox()];
    expect(labBox!.y).toBe(callBox!.y);
    expect(Math.abs(labBox!.x - callBox!.x)).toBeGreaterThanOrEqual(labBox!.width);
  });
});
