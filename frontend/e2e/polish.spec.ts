import { expect, test } from "@playwright/test";
import { mockApi, reachCraft } from "./mocks";

test("no third-party requests are made (self-hosted fonts, local avatar)", async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(baseURL!) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  await mockApi(page);
  await reachCraft(page);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  expect(fonts.join(" ")).toMatch(/Inter/);
  expect(external).toEqual([]);
});

test("provider radiogroup supports arrow-key navigation", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "Provider" });
  const anthropic = group.getByRole("radio", { name: "Anthropic" });
  await anthropic.focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: /Ollama/ })).toBeChecked();
  await expect(page.getByLabel("Ollama URL")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(anthropic).toBeChecked();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("sticky header is compact (<= 72px) and has a solid/glass background", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    const header = page.locator("header");
    const box = await header.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(72);
    const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("regenerate-bullet button is visible without hover", async ({ page }) => {
    await mockApi(page);
    await reachCraft(page);
    const btn = page.getByRole("button", { name: "Regenerate this bullet" }).first();
    await expect(btn).toBeVisible();
    expect(Number(await btn.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  });
});
