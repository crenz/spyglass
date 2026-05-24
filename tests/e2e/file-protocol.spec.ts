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

  test("renders the splash flow when served from file://", async ({ page }) => {
    await page.goto(fileUrl);

    const splash = page.getByTestId("splash");
    await expect(splash).toBeVisible({ timeout: 10_000 });
    await expect(splash).toHaveAttribute("data-scene-id", "title");
    await expect(page.getByRole("img", { name: "Title" })).toBeVisible();

    await splash.click();
    await expect(splash).toHaveAttribute("data-scene-id", "intro");
  });
});
