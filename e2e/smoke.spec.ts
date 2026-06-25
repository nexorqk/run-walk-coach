import { expect, test } from "@playwright/test";

test("local user can complete the core browser flow", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Start locally" }).click();
  await expect(page.getByRole("heading", { name: /Level 1/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build the week, not just today" })).toBeVisible();
  await page.getByRole("button", { name: "3 runs" }).click();
  await expect(page.getByText("Runs: 0/3")).toBeVisible();

  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByText("WARMUP")).toBeVisible();
  await page.getByRole("button", { name: /Finish/ }).click();

  await expect(page.getByRole("heading", { name: "How did it feel?" })).toBeVisible();
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("heading", { name: "Session saved" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "History" }).click();
  await expect(page.getByText(/Level 1/)).toBeVisible();

  await page.getByTitle("Edit session").click();
  await page.getByRole("button", { name: "7" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Session updated")).toBeVisible();
  await expect(page.getByText("D7")).toBeVisible();

  await page.getByLabel("Primary navigation").getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { name: "Recent sessions" })).toBeVisible();
  await expect(page.getByText("Difficulty trend")).toBeVisible();

  await page.getByLabel("Primary navigation").getByRole("link", { name: "Settings" }).click();
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
