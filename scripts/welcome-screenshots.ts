/**
 * Retakes the welcome page's screenshots (`public/welcome/<id>-{light,dark}.jpg`) from the sample week, each in a
 * fresh demo workspace. Needs the app running in demo mode at `BASE_URL` (default http://localhost:3200), e.g.
 * `DEMO_MODE=true NEXT_DEV_INDICATORS=off npx next dev -p 3200`.
 */
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = "public/welcome";

/** `YYYY-MM-DDTHH:mm` for `time` on the date `days` from today, in this machine's time zone. */
function localDateTime(days: number, time: string): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

async function openTask(page: Page, title: string) {
  await page.goto(`${BASE_URL}/tasks`);
  await page
    .getByRole("region", { name: "Task list" })
    .getByRole("link", { name: new RegExp(`^${title}`) })
    .first()
    .click();
  await page.getByRole("complementary", { name: "Edit item" }).waitFor();
}

async function scrollTo(page: Page, locator: ReturnType<Page["locator"]>, block: ScrollLogicalPosition = "start") {
  await locator.first().evaluate((element, position) => element.scrollIntoView({ block: position }), block);
}

/** Each scene sets up the page its slide shows, in a workspace holding the sample week. */
const SCENES: Record<string, (page: Page) => Promise<void>> = {
  // The calendar opens at the current time by itself.
  week: async () => {},
  add: async (page) => {
    await page.goto(`${BASE_URL}/tasks?new`);
    const form = page.getByRole("complementary", { name: "New item" });
    await form.getByLabel("Title").fill("Write report");
    await form.getByLabel("Duration", { exact: true }).fill("3h");
    await form.getByLabel("Due").fill(localDateTime(2, "17:00"));
    await form.getByLabel("Title").focus();
  },
  split: async (page) => {
    await openTask(page, "CS project");
    await scrollTo(page, page.getByText("How to schedule"));
  },
  repeat: async (page) => {
    await openTask(page, "Gym");
    await scrollTo(page, page.getByLabel("How often"), "center");
  },
  priority: async (page) => {
    await openTask(page, "Gym");
  },
  queue: async (page) => {
    await page.goto(`${BASE_URL}/tasks?new`);
    const form = page.getByRole("complementary", { name: "New item" });
    await form.getByLabel("Title").fill("Grant application");
    await form.getByLabel("Duration", { exact: true }).fill("20h");
    await form.getByLabel("Due").fill(localDateTime(1, "12:00"));
    await form.getByRole("button", { name: "Add item" }).click();
    await form.waitFor({ state: "hidden" });
    await page.goto(BASE_URL);
    await page.getByRole("radio", { name: /^Queue/ }).click();
  },
  missed: async (page) => {
    await scrollTo(page, page.getByRole("button", { name: /\(missed\)$/ }), "nearest");
  },
  categories: async (page) => {
    const chips = page.getByRole("group", { name: "Shown categories" });
    for (const name of ["Calculus", "Health", "Seminar", "No category"]) {
      await chips.getByRole("button", { name }).click();
    }
  },
  stats: async (page) => {
    await page.goto(`${BASE_URL}/stats`);
  },
};

async function main() {
  const browser = await chromium.launch();
  try {
    for (const [id, scene] of Object.entries(SCENES)) {
      for (const colorScheme of ["light", "dark"] as const) {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 2,
          colorScheme,
        });
        const page = await context.newPage();
        await page.goto(`${BASE_URL}/welcome`);
        await page.getByRole("button", { name: "Try the demo" }).click();
        await page.waitForURL(`${BASE_URL}/`);
        await scene(page);
        await page.waitForTimeout(500); // transitions settle
        await page.screenshot({ path: `${OUT}/${id}-${colorScheme}.jpg`, type: "jpeg", quality: 85 });
        await context.close();
        console.log(`${id}-${colorScheme}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
