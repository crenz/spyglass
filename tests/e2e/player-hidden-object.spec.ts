import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function goToHog(page: Page) {
  await page.goto("/");
  await page.getByTestId("splash").click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("hog-scene")).toBeVisible();
}

test.describe("hidden object scene", () => {
  test("finds three items with mouse and auto-advances", async ({ page }) => {
    await goToHog(page);
    await page.getByRole("button", { name: /brass key/i }).click();
    await page.getByRole("button", { name: /leather book/i }).click();
    await page.getByRole("button", { name: /porcelain cup/i }).click();
    await expect(page.getByTestId("splash")).toHaveAttribute(
      "data-scene-id",
      "intro",
    );
  });

  test("marks paired references as found via data-found", async ({ page }) => {
    await goToHog(page);
    await page.getByRole("button", { name: /brass key/i }).click();
    await expect(page.locator('[data-region-id="r_key"]')).toHaveAttribute(
      "data-found",
      "true",
    );
    await expect(page.locator('[data-region-id="r_book"]')).toHaveAttribute(
      "data-found",
      "false",
    );
  });

  test("activates targets via the keyboard only", async ({ page }) => {
    await goToHog(page);
    // The first active objective should be focused on entry.
    const first = page.getByRole("button", { name: /brass key/i });
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    // Focus moves to the next active objective.
    await expect(
      page.getByRole("button", { name: /leather book/i }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("splash")).toHaveAttribute(
      "data-scene-id",
      "intro",
    );
  });

  test("announces each find to assistive tech", async ({ page }) => {
    await goToHog(page);
    await page.getByRole("button", { name: /brass key/i }).click();
    await expect(page.getByRole("status")).toContainText(/found: brass key/i);
  });
});
