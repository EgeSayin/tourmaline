import { expect, test as setup } from "@playwright/test";
import { E2E_ACCOUNT, SIGNED_IN_STATE } from "./helpers";

setup("signs in as the e2e account", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Username").fill(E2E_ACCOUNT.username);
  await page.getByLabel("Password").fill(E2E_ACCOUNT.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: SIGNED_IN_STATE });
});
