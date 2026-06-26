import { expect, test } from "@playwright/test";

test("local user can complete the core browser flow", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start locally" }).click();
  await expect(page.getByRole("heading", { name: /Level 1/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build the week, not just today" })).toBeVisible();
  await page.getByRole("button", { name: "3 runs" }).click();
  await expect(page.getByText("Runs: 0/3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you run" })).toBeVisible();
  await expect(page.getByText("Ready for the plan")).toBeVisible();

  await page.getByLabel("Primary navigation").getByRole("link", { name: "Coach" }).click();
  await expect(page.getByRole("heading", { name: "What to do today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What your data says" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why pulse gets high" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How to measure pulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When not to run" })).toBeVisible();
  await page.getByLabel("Primary navigation").getByRole("link", { name: "Today" }).click();

  await page.getByRole("button", { name: "Start workout" }).first().click();
  await expect(page.getByText("WARMUP")).toBeVisible();
  await page.getByRole("button", { name: /Finish/ }).click();

  await expect(page.getByRole("heading", { name: "How did it feel?" })).toBeVisible();
  await page.getByLabel("Distance, km").fill("1.2");
  await page.getByLabel("Avg pace").fill("8:30");
  await page.getByLabel("Speed, km/h").fill("7.1");
  await page.getByLabel("Cadence, spm").fill("160");
  await page.getByLabel("Pulse by stopwatch").fill("144");
  await page.getByLabel("Heart-rate zone").selectOption("ZONE_2");
  await page.getByLabel("Breathing details").fill("Could speak short phrases.");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("heading", { name: "Session saved" })).toBeVisible();
  await expect(page.getByText("1.20 km")).toBeVisible();
  await expect(page.getByText("8:30/km")).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "History" }).click();
  await expect(page.getByText(/Level 1/)).toBeVisible();
  await expect(page.getByText("160 spm")).toBeVisible();
  await expect(page.getByText("Could speak short phrases.")).toBeVisible();

  await page.getByTitle("Edit session").click();
  await page.getByRole("button", { name: "7" }).click();
  await page.getByLabel("Cadence, spm").fill("166");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Session updated")).toBeVisible();
  await expect(page.getByText("D7")).toBeVisible();
  await expect(page.getByText("166 spm")).toBeVisible();

  await page.getByLabel("Primary navigation").getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { name: "Recent sessions" })).toBeVisible();
  await expect(page.getByText("Difficulty trend")).toBeVisible();
  await expect(page.getByText("Avg pace")).toBeVisible();
  await expect(page.getByText("1.20 km").first()).toBeVisible();

  await page.getByLabel("Primary navigation").getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Open Data & Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Where data is stored" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What syncs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How to export data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How to delete data" })).toBeVisible();
  await page.getByRole("link", { name: "Back to settings" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^run-walk-coach-.+\.json$/);

  await page.getByLabel("Primary navigation").getByRole("link", { name: "History" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("Delete session").click();
  await expect(page.getByText("Session deleted")).toBeVisible();
  await expect(page.getByText("No sessions yet.")).toBeVisible();
});
