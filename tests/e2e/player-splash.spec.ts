import { test, expect } from "@playwright/test";

test.describe("splash flow", () => {
  test("walks title → cutscene → HOG → intro → done via click + Skip + finds + keyboard", async ({
    page,
  }) => {
    await page.goto("/");

    const splash = page.getByTestId("splash");
    await expect(splash).toBeVisible();
    await expect(splash).toHaveAttribute("data-scene-id", "title");
    await expect(splash).toHaveAttribute("data-advance", "click");
    await expect(page.getByText(/click or press enter/i)).toBeVisible();
    await expect(page.getByRole("img", { name: "Title" })).toBeVisible();

    await splash.click();

    const cutscene = page.getByTestId("cutscene");
    await expect(cutscene).toBeVisible();
    await expect(cutscene).toHaveAttribute("data-scene-id", "intro_video");
    await page.getByRole("button", { name: /skip/i }).click();

    const hog = page.getByTestId("hog-scene");
    await expect(hog).toBeVisible();
    await expect(hog).toHaveAttribute("data-scene-id", "scene_1");
    await page.getByRole("button", { name: /brass key/i }).click();
    await page.getByRole("button", { name: /leather book/i }).click();
    await page.getByRole("button", { name: /porcelain cup/i }).click();

    await expect(splash).toHaveAttribute("data-scene-id", "intro");
    await expect(splash).toHaveAttribute("data-advance", "key");
    await expect(page.getByRole("img", { name: "Intro" })).toBeVisible();
    await expect(page.getByText(/press any key/i)).toBeVisible();

    await page.keyboard.press("x");

    await expect(splash).toHaveAttribute("data-done", "true");
    await expect(splash).toBeDisabled();
    await expect(page.getByRole("status")).toContainText(/game over/i);
  });

  test("advances the first splash via the keyboard alone", async ({ page }) => {
    await page.goto("/");
    const splash = page.getByTestId("splash");
    await expect(splash).toHaveAttribute("data-scene-id", "title");
    await expect(splash).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cutscene")).toHaveAttribute(
      "data-scene-id",
      "intro_video",
    );
  });

  test("announces the active scene to assistive tech", async ({ page }) => {
    await page.goto("/");
    const live = page.getByRole("status");
    await expect(live).toContainText(/now showing: title/i);
    await page.getByTestId("splash").click();
    await expect(live).toContainText(/now showing: intro/i);
  });
});
