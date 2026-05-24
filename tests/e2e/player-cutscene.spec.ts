import { test, expect } from "@playwright/test";

async function goToCutscene(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("splash").click();
  await expect(page.getByTestId("cutscene")).toBeVisible();
}

test.describe("cutscene flow", () => {
  test("starts muted and renders a captions track", async ({ page }) => {
    await goToCutscene(page);
    const video = page.getByTestId("cutscene-video");
    await expect(video).toHaveJSProperty("muted", true);
    const track = page.getByTestId("cutscene-captions");
    await expect(track).toHaveAttribute("kind", "captions");
    await expect(track).toHaveAttribute("src", /\/videos\/intro\.vtt$/);
  });

  test("advances when the user clicks Skip", async ({ page }) => {
    await goToCutscene(page);
    await page.getByRole("button", { name: /skip/i }).click();
    await expect(page.getByTestId("hog-scene")).toHaveAttribute(
      "data-scene-id",
      "scene_1",
    );
  });

  test("Skip is keyboard-reachable and activates on Enter", async ({
    page,
  }) => {
    await goToCutscene(page);
    const skip = page.getByRole("button", { name: /skip/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("hog-scene")).toHaveAttribute(
      "data-scene-id",
      "scene_1",
    );
  });

  test("advances automatically when the video ends", async ({ page }) => {
    await goToCutscene(page);
    // The fixture video is ~2s. Allow generous headroom on slow CI.
    await expect(page.getByTestId("hog-scene")).toHaveAttribute(
      "data-scene-id",
      "scene_1",
      { timeout: 15_000 },
    );
  });
});
