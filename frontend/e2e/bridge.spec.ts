import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { bridge, jd, match, mockApi, press, profile, reachMatch } from "./mocks";

/** A Match column (Matched / Missing / Added), found by its "<Name> (<count>)" header. */
const column = (page: Page, header: string) => page.getByText(header, { exact: true }).locator("..");
const gauge = (page: Page, score: number) => page.getByRole("img", { name: `ATS match: ${score} out of 100` });
const kubernetes = { skill: "Kubernetes", evidence: "Docker", self_attested: false };

async function bridgeGaps(page: Page) {
  await page.getByRole("button", { name: /Bridge gaps/ }).click();
  await expect(page.getByText("Gaps analysed")).toBeVisible();
}

test("Bridge gaps shows verdicts; Include all supported moves them to Added with a score preview", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = await mockApi(page);
  await reachMatch(page);
  await expect(page.getByText("Missing (2)", { exact: true })).toBeVisible();
  await expect(gauge(page, 72)).toBeVisible();
  // Missing skills are clickable, but carry no verdict until the bridge has run.
  await expect(page.getByRole("button", { name: "Kubernetes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Include all supported/ })).toHaveCount(0);

  await bridgeGaps(page);
  await expect(page.getByText("1 skill(s) are backed by your existing experience.")).toBeVisible();
  expect(calls.bodies["/api/bridge"]).toHaveLength(1);
  expect(calls.bodies["/api/bridge"][0]).toMatchObject({ missing: match.missing, gaps: match.gaps, jd: { title: jd.title }, profile: { contact: { name: "Ada Lovelace" } } });
  await expect(page.getByRole("button", { name: "Kubernetes: Supported by your profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go: No support found in your profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Re-check gaps/ })).toBeVisible();

  await page.getByRole("button", { name: "Include all supported (1)" }).click();
  await expect(column(page, "Added (1)").getByRole("button", { name: /^Kubernetes/ })).toBeVisible();
  await expect(column(page, "Missing (1)").getByRole("button", { name: /^Go/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Include all supported/ })).toHaveCount(0);
  // Keywords: 7/9 weighted hits -> 8/9 with Kubernetes = 89; overall 0.55 * 89 + 0.45 * 74 = 82.
  await expect(page.getByText("Preview with 1 added skill(s), was 72")).toBeVisible();
  await expect(gauge(page, 82)).toBeVisible();
  await expect(page.getByText("89", { exact: true })).toBeVisible();

  // Approved skills travel with the profile into generation; nothing else is auto-added.
  await press(page, /Craft documents/);
  await press(page, /Generate Resume/);
  await expect(page.getByText("Resume ready")).toBeVisible();
  expect(calls.bodies["/api/generate"][0]).toMatchObject({ auto_bridge: false, profile: { attested_skills: [kubernetes] } });
  expect(errors).toEqual([]);
});

test("the gap popover requires evidence to self-attest, and can exclude a skill again", async ({ page }) => {
  const calls = await mockApi(page);
  await reachMatch(page);
  await bridgeGaps(page);

  // Unsupported skill: the user must say what backs it, and is warned it is self-attested.
  await page.getByRole("button", { name: /^Go: / }).click();
  const go = page.getByRole("dialog", { name: "Bridge Go" });
  await expect(go.getByText("No support found in your profile")).toBeVisible();
  await expect(go.getByText("No Go experience in the profile.")).toBeVisible();
  await go.getByLabel("Include in my documents").check();
  await expect(go.getByText(/Only include this if you genuinely have the skill/)).toBeVisible();
  await expect(go.getByRole("button", { name: "Save" })).toBeDisabled();
  await go.getByLabel("Evidence from your experience").fill("Wrote Go CLIs for internal tooling");
  await go.getByRole("button", { name: "Save" }).click();
  await expect(go).toBeHidden();
  await expect(column(page, "Added (1)").getByRole("button", { name: /^Go/ })).toBeVisible();

  // Reopening shows the saved state; unchecking moves it back to Missing.
  await column(page, "Added (1)").getByRole("button", { name: /^Go/ }).click();
  await expect(go.getByLabel("Include in my documents")).toBeChecked();
  await expect(go.getByLabel("Evidence from your experience")).toHaveValue("Wrote Go CLIs for internal tooling");
  await go.getByLabel("Include in my documents").uncheck();
  await go.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Added (0)", { exact: true })).toBeVisible();
  await expect(column(page, "Missing (2)").getByRole("button", { name: /^Go/ })).toBeVisible();

  // Supported skill: evidence is prefilled from the bridge, no self-attestation warning.
  // Escape and Cancel both close without saving.
  await page.getByRole("button", { name: /^Kubernetes: / }).click();
  const k8s = page.getByRole("dialog", { name: "Bridge Kubernetes" });
  await expect(k8s.getByLabel("Evidence from your experience")).toHaveValue("Docker");
  await k8s.getByLabel("Include in my documents").check();
  await expect(k8s.getByText(/Only include this if you genuinely have the skill/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(k8s).toBeHidden();
  await page.getByRole("button", { name: /^Kubernetes: / }).click();
  await k8s.getByLabel("Include in my documents").check();
  await k8s.getByRole("button", { name: "Cancel" }).click();
  await expect(k8s).toBeHidden();
  await expect(page.getByText("Added (0)", { exact: true })).toBeVisible();

  // Re-include Go and check it reaches generation marked as self-attested.
  await page.getByRole("button", { name: /^Go: / }).click();
  await go.getByLabel("Include in my documents").check();
  await go.getByLabel("Evidence from your experience").fill("Wrote Go CLIs for internal tooling");
  await go.getByRole("button", { name: "Save" }).click();
  await press(page, /Craft documents/);
  await press(page, /Generate Resume/);
  await expect(page.getByText("Resume ready")).toBeVisible();
  expect(calls.bodies["/api/generate"][0].profile.attested_skills).toEqual([
    { skill: "Go", evidence: "Wrote Go CLIs for internal tooling", self_attested: true },
  ]);
});

test("added skills are listed in the profile editor and can be removed there", async ({ page }) => {
  await mockApi(page);
  await reachMatch(page);
  await bridgeGaps(page);
  await page.getByRole("button", { name: /^Go: / }).click();
  const go = page.getByRole("dialog", { name: "Bridge Go" });
  await go.getByLabel("Include in my documents").check();
  await go.getByLabel("Evidence from your experience").fill("Wrote Go CLIs");
  await go.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Include all supported (1)" }).click();
  await expect(page.getByText("Added (2)", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Step 2: Profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Your story, structured/ })).toBeVisible();
  const section = page.getByText("Added skills (from Match)").locator("xpath=ancestor::*[.//button[starts-with(@aria-label, 'Remove ')]][1]");
  await expect(section.getByText("Self-attested")).toHaveCount(1);
  await expect(section.locator("input").first()).toHaveValue("Go");
  await section.getByRole("button", { name: "Remove Go" }).click();
  await expect(section.getByText("Self-attested")).toHaveCount(0);

  await page.getByRole("button", { name: "Step 4: Match" }).click();
  await expect(page.getByText("Added (1)", { exact: true })).toBeVisible();
  await expect(column(page, "Missing (1)").getByRole("button", { name: /^Go/ })).toBeVisible();
});

test("Craft auto-add: bridge event adds skills, quick chips feed instructions, info flags are kept apart", async ({ page }) => {
  const calls = await mockApi(page, {
    autoBridge: { items: bridge.items, added: [kubernetes] },
    flags: [
      { text: "Led a team of 4 engineers on a migration to PostgreSQL.", section: 1, item: 0, bullet: 1, unsupported: ["team of 4"], reason: "Not traceable to your profile", level: "warn" },
      { text: "Kubernetes", section: 2, item: -1, bullet: -1, unsupported: ["Kubernetes"], reason: "Added from your Match approvals, backed by: Docker", level: "info" },
    ],
  });
  await reachMatch(page);
  await press(page, /Craft documents/);
  await expect(page.getByRole("button", { name: "Weave in added skills" })).toHaveCount(0);

  await page.getByLabel(/Auto-add related missing skills/).check();
  await press(page, /Generate Resume/);
  await expect(page.getByText("Added related skills: Kubernetes")).toBeVisible();
  expect(calls.bodies["/api/generate"][0]).toMatchObject({ kind: "resume", auto_bridge: true, instructions: "" });

  // Only the warn-level flag counts as unverified; the info note is shown on its own.
  await expect(page.getByText("1 claim(s) flagged for review.")).toBeVisible();
  const truth = page.locator("aside").filter({ hasText: "Truthfulness check" });
  await expect(truth.getByText("team of 4", { exact: true })).toBeVisible();
  await expect(truth.getByText("Added from your Match approvals, backed by: Docker")).toBeVisible();
  await expect(truth.getByText("Every claim traces back to your profile.")).toHaveCount(0);

  // Quick chips append once each, joined with "; ".
  const instr = page.getByLabel("Extra instructions (optional)");
  await page.getByRole("button", { name: "Weave in added skills" }).click();
  await page.getByRole("button", { name: "Emphasize Kubernetes" }).click();
  await page.getByRole("button", { name: "Emphasize Kubernetes" }).click();
  const expected = "Weave the user-confirmed skills into the summary, skills and the most relevant bullets, grounded in their evidence; Emphasize Kubernetes";
  await expect(instr).toHaveValue(expected);

  // The auto-added skill is now on the profile, so a plain regenerate still carries it.
  await page.getByLabel(/Auto-add related missing skills/).uncheck();
  await page.getByRole("button", { name: /Regenerate Resume/ }).click();
  await expect.poll(() => calls.bodies["/api/generate"].length).toBe(2);
  expect(calls.bodies["/api/generate"][1]).toMatchObject({ auto_bridge: false, instructions: expected, profile: { attested_skills: [kubernetes] } });

  // Export counts only unverified claims.
  await press(page, /^Export/);
  await expect(page.getByText("1 unverified claim(s) remain in this document.", { exact: false })).toBeVisible();

  // Match shows the auto-added skill under Added, with the bridge verdict from the stream.
  await page.getByRole("button", { name: "Step 4: Match" }).click();
  await expect(column(page, "Added (1)").getByRole("button", { name: "Kubernetes: Supported by your profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Re-check gaps/ })).toBeVisible();
});

test("with nothing missing there is no bridge or auto-add UI", async ({ page }) => {
  await mockApi(page, { match: { ...match, matched: [...match.matched, ...match.missing], missing: [] } });
  await reachMatch(page);
  await expect(page.getByText("Nothing missing")).toBeVisible();
  await expect(page.getByRole("button", { name: /Bridge gaps/ })).toHaveCount(0);
  await press(page, /Craft documents/);
  await expect(page.getByRole("heading", { level: 1, name: /Craft your documents/ })).toBeVisible();
  await expect(page.getByLabel(/Auto-add related missing skills/)).toHaveCount(0);
});

test("added skills and bridge verdicts survive a session save/load, without the API key", async ({ page }) => {
  await mockApi(page);
  await reachMatch(page);
  await bridgeGaps(page);
  await page.getByRole("button", { name: "Include all supported (1)" }).click();
  await expect(page.getByText("Added (1)", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const raw = await readFile((await (await download).path())!, "utf8");
  expect(raw).not.toContain("sk-ant-test-key");
  const saved = JSON.parse(raw);
  expect(saved.profile.attested_skills).toEqual([kubernetes]);
  expect(saved.jobs[0].bridge).toEqual(bridge.items);

  // A fresh page has nothing in memory; loading the file restores the Added column and verdicts.
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByLabel("Load session").click();
  await (await chooser).setFiles({ name: "s.json", mimeType: "application/json", buffer: Buffer.from(raw) });
  await expect(page.getByText("Session restored")).toBeVisible();
  await expect(column(page, "Added (1)").getByRole("button", { name: "Kubernetes: Supported by your profile" })).toBeVisible();
  await expect(gauge(page, 82)).toBeVisible();
});

test("a session with unknown bridge verdicts or missing attestation flags is normalized", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByLabel("Load session").click();
  const session = {
    app: "TailorUrResume", version: 1,
    profile: { ...profile, attested_skills: [{ skill: "Go", evidence: "Go CLIs" }] },
    jobs: [{ id: "j1", jd, match, bridge: [{ skill: "Kubernetes", verdict: "maybe", evidence: null }], docs: {} }],
  };
  await (await chooser).setFiles({ name: "s.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(session)) });
  await expect(page.getByText("Session restored")).toBeVisible();
  await expect(column(page, "Missing (1)").getByRole("button", { name: "Kubernetes: No support found in your profile" })).toBeVisible();
  await expect(column(page, "Added (1)").getByRole("button", { name: "Go", exact: true })).toBeVisible();
});
