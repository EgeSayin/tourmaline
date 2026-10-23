import { type Browser, expect, type Page, test } from "@playwright/test";
import { E2E_ACCOUNT, isPhone } from "./helpers";

// Signed out: these specs sign in and out themselves, keeping the shared session out of it.
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test.describe("accounts", () => {
  test("sends a visitor to sign in, refuses a wrong password and closed sign-up, and signs in and out", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.getByRole("link", { name: "Create one" }).click();
    await expect(page.getByRole("note")).toHaveText("Sign-up is closed. Ask the admin to open it.");
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();

    await signIn(page, E2E_ACCOUNT.username, "not-the-password");
    await expect(page.getByText("Wrong username or password")).toBeVisible();
    await signIn(page, E2E_ACCOUNT.username.toUpperCase(), E2E_ACCOUNT.password);
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/settings");
    await expect(page.getByText("Signed in as e2e, the admin.")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("lets the admin open sign-up for someone new, who starts empty and changes their password", async ({
    page,
    browser,
  }, testInfo) => {
    // Sign-up is one switch for the whole instance: projects running at once would flip it under each other.
    test.skip(isPhone(testInfo), "Covered on desktop");
    const username = `newcomer-${Date.now()}`;

    await signIn(page, E2E_ACCOUNT.username, E2E_ACCOUNT.password);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Open sign-up" }).click();
    await expect(page.getByText("Open: anyone who can reach this instance can create an account.")).toBeVisible();

    const newcomer = await newPage(browser);
    await newcomer.goto("/sign-up");
    await newcomer.getByLabel("Username").fill(username);
    await newcomer.getByLabel("Password").fill("short");
    await newcomer.getByRole("button", { name: "Create account" }).click();
    await expect(newcomer.getByText("Use at least 8 characters")).toBeVisible();
    await newcomer.getByLabel("Password").fill("first-password");
    await newcomer.getByRole("button", { name: "Create account" }).click();
    await expect(newcomer).toHaveURL(/\/$/);
    await newcomer.goto("/tasks");
    await expect(newcomer.getByText("CS project")).toHaveCount(0);

    await newcomer.goto("/settings");
    await expect(newcomer.getByText(`Signed in as ${username}.`)).toBeVisible();
    await expect(newcomer.getByRole("button", { name: /sign-up/ })).toHaveCount(0);
    await newcomer.getByLabel("Current password").fill("wrong-password");
    await newcomer.getByLabel("New password").fill("second-password");
    await newcomer.getByRole("button", { name: "Change password" }).click();
    await expect(newcomer.getByText("Wrong password")).toBeVisible();
    await newcomer.getByLabel("Current password").fill("first-password");
    await newcomer.getByLabel("New password").fill("second-password");
    await newcomer.getByRole("button", { name: "Change password" }).click();
    await expect(newcomer.getByText("Changed. Your other devices are signed out.")).toBeVisible();
    await newcomer.getByRole("button", { name: "Sign out" }).click();
    await signIn(newcomer, username, "second-password");
    await expect(newcomer).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Close sign-up" }).click();
    await expect(page.getByText("Closed: only existing accounts can sign in.")).toBeVisible();
  });
});
