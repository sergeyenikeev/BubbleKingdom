import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand-title")).toBeVisible();
});

test("loads the shell and starts the first playable level", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="start-current-level"]');

  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator("#game-canvas canvas")).toBeVisible();
  await expect(page.locator(".pill").first()).toContainText(/Goal|Цель/);

  await page.mouse.move(360, 560);
  await page.mouse.click(360, 560);
});

test("opens the shop and persists a mock purchase to save storage", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  await expect(page.locator('[data-action="purchase-offer"]').first()).toBeVisible();

  await page.locator('[data-action="purchase-offer"]').first().click();

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const raw = window.localStorage.getItem("bubble-kingdom:save");
        if (!raw) {
          return null;
        }

        const save = JSON.parse(raw) as {
          economy?: { firstPurchaseAt?: string | null };
        };
        return save.economy?.firstPurchaseAt ?? null;
      });
    })
    .not.toBeNull();
});

async function dismissDailyReward(page: Page) {
  const claimButton = page.locator('[data-action="claim-daily"]');
  if ((await claimButton.count()) > 0) {
    await claimButton.click();
    await expect(claimButton).toBeHidden();
  }
}
