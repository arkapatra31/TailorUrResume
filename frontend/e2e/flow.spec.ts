import { expect, test, type Page } from "@playwright/test";
import { dumpStorage, mockApi } from "./mocks";

/** Click a footer button once the previous step has finished its exit animation (only one match left). */
async function press(page: Page, name: RegExp) {
  const b = page.getByRole("button", { name });
  await expect(b).toHaveCount(1);
  await b.click();
}
const heading = (page: Page, name: RegExp | string) => page.getByRole("heading", { level: 1, name });

test("Key -> Profile -> Job -> Match -> Craft -> Export", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockApi(page);
  await page.goto("/");

  // Step 1: Key. Toggle the provider back and forth before Continue (exercises the shared layoutId pill).
  await expect(heading(page, /Bring your own brain/)).toBeVisible();
  await page.getByRole("radio", { name: /Ollama/ }).click();
  await expect(page.getByLabel("Ollama URL")).toBeVisible();
  await page.getByRole("radio", { name: /Anthropic/ }).click();
  await page.getByLabel("API key").fill("sk-ant-test-key");
  await press(page, /Continue/);

  // Step 2: Profile
  await expect(heading(page, /Your story, structured/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") });
  await expect(page.getByText("Parsed from")).toBeVisible();
  await press(page, /Continue/);

  // Step 3: Job
  await expect(heading(page, /Pick your target/)).toBeVisible();
  await press(page, /Add a job/);
  await page.getByLabel("Job description").fill("We need a Backend Engineer with Python and PostgreSQL experience. Docker is a plus.");
  await press(page, /Extract details/);
  await expect(page.getByRole("button", { name: /Re-extract details/ })).toBeVisible();
  await press(page, /Analyze match/);

  // Step 4: Match (must not hang on a blank <main>)
  await expect(heading(page, /How well do you fit/)).toBeVisible();
  await expect(page.getByText("Keywords", { exact: true })).toBeVisible();
  await press(page, /Craft documents/);

  // Step 5: Craft
  await expect(heading(page, /Craft your documents/)).toBeVisible();
  await page.getByRole("button", { name: /Generate Resume/ }).click();
  await expect(page.getByText("Analytical Engines Ltd").first()).toBeVisible();
  await expect(page.locator("#main").getByText("Every claim traces back to your profile.")).toBeVisible();
  await press(page, /^Export/);

  // Step 6: Export
  await expect(heading(page, /Ship it/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Download PDF/ })).toBeVisible();

  expect(await dumpStorage(page)).toEqual({ local: 0, session: 0, cookies: "", idb: 0 });
  expect(errors).toEqual([]);
});

test("a failed match shows an error with Retry", async ({ page }) => {
  await mockApi(page, { matchFails: 1 });
  await page.goto("/");
  await page.getByLabel("API key").fill("sk-ant-test-key");
  await press(page, /Continue/);
  await press(page, /Start from a blank profile/);
  await press(page, /Continue/);
  await press(page, /Add a job/);
  await page.getByLabel("Job description").fill("We need a Backend Engineer with Python and PostgreSQL experience.");
  await press(page, /Extract details/);
  await press(page, /Analyze match/);
  await expect(page.getByRole("alert").filter({ hasText: "Model overloaded." })).toBeVisible();
  await page.getByRole("button", { name: /Retry/ }).click();
  await expect(page.getByText("Semantic fit")).toBeVisible();
});

test("a malformed session file shows the recovery screen, not a white page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("Load session").click({ trial: true });
  const chooser = page.waitForEvent("filechooser");
  await page.getByLabel("Load session").click();
  await (await chooser).setFiles({ name: "s.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ app: "TailorUrResume", version: 1, profile: { experience: "nope" }, jobs: [{ jd: 5 }] })) });
  // Either the import is rejected with a toast or sanitized; the app must stay usable.
  await expect(page.getByRole("navigation", { name: "Progress" })).toBeVisible();
  await expect(page.locator("main")).not.toBeEmpty();
});
