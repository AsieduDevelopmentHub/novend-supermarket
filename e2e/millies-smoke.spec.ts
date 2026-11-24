import { expect, test } from "@playwright/test";

/**
 * Millie's smoke — UI availability and list remount behaviour.
 * Deep stock/till math is covered by Vitest (adjust-stock-sync, till-auto-close).
 */
test.describe("Millie's supermarket smoke", () => {
  test("login (or setup) route loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    // First install shows setup; returning till shows login form.
    const setupOrLogin = page
      .getByRole("heading", { name: /Millie|set up|sign in|login/i })
      .or(page.getByText(/Millie's Supermarket/i))
      .or(page.locator("input[type='password'], input[name='username'], input[name='password']").first());
    await expect(setupOrLogin.first()).toBeVisible({ timeout: 30_000 });
  });

  test("products route does not stay blank forever when already signed in", async ({ page }) => {
    await page.goto("/products");
    // Either redirected to login/setup, or products shell paints.
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
    const stuckLoading =
      (await page.getByText("Loading products…").count()) > 0 &&
      (await page.getByText(/No products|Add Product|SKU/i).count()) === 0;
    // Warm remount should not leave an empty loading-only screen for > few seconds.
    if (stuckLoading) {
      await page.waitForTimeout(5000);
      const stillOnlyLoading =
        (await page.getByText("Loading products…").count()) > 0 &&
        (await page.getByText(/No products|Add Product|SKU|Search products/i).count()) === 0;
      expect(stillOnlyLoading).toBe(false);
    }
  });

  test("sales → products navigation keeps the shell responsive", async ({ page }) => {
    await page.goto("/sales");
    await page.waitForTimeout(800);
    await page.goto("/products");
    await page.waitForTimeout(800);
    await page.goto("/sales");
    await page.waitForTimeout(800);
    await page.goto("/products");
    await expect(page.locator("body")).toBeVisible();
  });
});
