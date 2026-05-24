import { test, expect } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const distIndex = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../dist/index.html",
);
const fileUrl = pathToFileURL(distIndex).toString();

test.describe("file:// deployment mode", () => {
  test.use({ baseURL: undefined });

  test("renders the splash + cutscene + HOG flow when served from file://", async ({
    page,
  }) => {
    await page.goto(fileUrl);

    const splash = page.getByTestId("splash");
    await expect(splash).toBeVisible({ timeout: 10_000 });
    await expect(splash).toHaveAttribute("data-scene-id", "title");
    await expect(page.getByRole("img", { name: "Title" })).toBeVisible();

    await splash.click();

    await expect(page.getByTestId("cutscene")).toBeVisible();
    await page.getByRole("button", { name: /skip/i }).click();

    const hog = page.getByTestId("hog-scene");
    await expect(hog).toBeVisible();
    await expect(hog).toHaveAttribute("data-scene-id", "scene_1");
    await page.getByRole("button", { name: /brass key/i }).click();
    await page.getByRole("button", { name: /leather book/i }).click();
    await page.getByRole("button", { name: /porcelain cup/i }).click();

    await expect(splash).toHaveAttribute("data-scene-id", "intro");
  });
});
