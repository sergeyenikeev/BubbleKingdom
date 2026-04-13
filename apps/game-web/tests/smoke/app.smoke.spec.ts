import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand-title")).toBeVisible();
});

test("loads the shell and starts the first playable level", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="start-current-level"]');
  await expect(page.locator(".prelevel-modal")).toBeVisible();
  await page.click('[data-action="confirm-start-level"]');

  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator("#game-canvas canvas")).toBeVisible();
  await expect(page.locator(".pill").first()).toContainText(
    /Goal|\u0426\u0435\u043b\u044c/u,
  );

  await page.mouse.move(360, 560);
  await page.mouse.click(360, 560);
});

test("win overlay lifts rewarded double-claim into a single focus CTA", async ({ page }) => {
  await openDebugShell(page);
  await dismissDailyReward(page);
  await forceDebugWin(page, 1);

  await expect(page.locator(".overlay-modal")).toContainText("Double Reward");
  await expect(page.locator(".overlay-focus-card")).toContainText("Double Reward");
  await expect(page.locator('.overlay-focus-card [data-action="claim-win-bonus"]')).toHaveCount(1);
  await expect(page.locator('.modal-card > .cta-row [data-action="claim-win-bonus"]')).toHaveCount(0);

  await page.click('.overlay-focus-card [data-action="claim-win-bonus"]');

  await expect(page.locator(".overlay-focus-card")).toContainText("Double reward claimed");
  await expect(page.locator('[data-action="claim-win-bonus"]')).toHaveCount(0);
});

test("fail overlay promotes the recommended continue into a single focus CTA", async ({ page }) => {
  await openDebugShell(page);
  await dismissDailyReward(page);
  await forceDebugFail(page, 2);

  await expect(page.locator(".fail-modal")).toContainText("Watch Ad + Moves");
  await expect(page.locator('.overlay-focus-card [data-action="continue-rewarded"]')).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-rewarded"]')).toHaveCount(0);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-gems"]')).toHaveCount(1);

  await page.click('.overlay-focus-card [data-action="continue-rewarded"]');

  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator(".overlay-modal")).toHaveCount(0);
});

test("fail overlay can switch to a gems-primary recovery path without duplicating the CTA", async ({ page }) => {
  await openDebugShell(page);
  await seedDebugFailProfile(page, {
    levelId: 24,
    gems: 80,
    rewardedViews: 4,
    piggyBankGold: 0,
    failVariant: "gems_primary",
  });
  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();
  await dismissDailyReward(page);
  await forceDebugFail(page, 24);

  await expect(page.locator(".fail-modal")).toContainText("Continue for 12 Gems");
  await expect(page.locator('.overlay-focus-card [data-action="continue-gems"]')).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-gems"]')).toHaveCount(0);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-rewarded"]')).toHaveCount(1);

  await page.click('.overlay-focus-card [data-action="continue-gems"]');

  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator(".overlay-modal")).toHaveCount(0);
});

test("piggy-primary fail flow pivots into gem continue after breaking the piggy bank", async ({
  page,
}) => {
  await openDebugShell(page);
  await seedDebugFailProfile(page, {
    levelId: 24,
    gems: 0,
    rewardedViews: 4,
    piggyBankGold: 270,
    failVariant: "piggy_primary",
  });
  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();
  await dismissDailyReward(page);
  await forceDebugFail(page, 24);

  await expect(page.locator(".overlay-focus-card")).toContainText("Piggy Bank");
  await expect(page.locator(".overlay-focus-card")).toContainText("270/300");
  await expect(page.locator('.overlay-focus-card [data-action="purchase-offer"]')).toHaveCount(1);
  await expect(page.locator(".fail-offer-card")).toHaveCount(0);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-rewarded"]')).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-gems"]')).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-gems"]')).toBeDisabled();

  await page.click('.overlay-focus-card [data-action="purchase-offer"]');

  await expect(page.locator(".overlay-focus-card")).toContainText("Continue for 12 Gems");
  await expect(page.locator('.overlay-focus-card [data-action="continue-gems"]')).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-gems"]')).toHaveCount(0);

  await page.click('.overlay-focus-card [data-action="continue-gems"]');

  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator(".overlay-modal")).toHaveCount(0);
});

test("fail overlay can sell a small gem rescue pack without leaving the recovery flow", async ({
  page,
}) => {
  await openDebugShell(page);
  await seedDebugFailProfile(page, {
    levelId: 24,
    gems: 0,
    rewardedViews: 4,
    piggyBankGold: 0,
    failVariant: "gems_primary",
  });
  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();
  await dismissDailyReward(page);
  await forceDebugFail(page, 24);

  await expect(page.locator(".overlay-focus-card")).toContainText("Watch Ad + Moves");
  const rescueCard = page.locator('.fail-offer-card[data-offer-id="gem_pack_s"]');
  await expect(rescueCard).toContainText("Gem Pack S");
  await expect(rescueCard).toContainText("Need 12 Gems");
  await expect(rescueCard).toContainText("Pack grants 75 Gems");
  await expect(rescueCard).toContainText("Left after continue 63 Gems");
  await rescueCard.locator('[data-action="purchase-offer"][data-id="gem_pack_s"]').click();

  await expect(page.locator(".reward-reveal-modal")).toHaveCount(0);
  await expect(page.locator(".fail-modal")).toBeVisible();
  await expect(page.locator(".fail-modal > h2")).toContainText("Recovery ready");
  await expect(page.locator(".overlay-focus-card.is-recovery-ready")).toHaveCount(1);
  await expect(page.locator(".overlay-focus-card")).toContainText("Recovery ready");
  await expect(page.locator(".overlay-focus-card")).toContainText("Continue for 12 Gems");
  await expect(page.locator(".overlay-focus-card")).toContainText("Ready now 75 Gems");
  await expect(page.locator(".overlay-focus-card")).toContainText("After continue 63 Gems");
  await expect(page.locator(".fail-secondary-note")).toContainText(
    "The free ad path is still available below if you would rather save gems.",
  );
  await expect(page.locator(".fail-modal .cta-row-stacked.is-secondary-recovery")).toHaveCount(1);
  await expect(page.locator(".fail-modal .fail-footer-row.is-secondary-exit")).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-rewarded"]')).toHaveClass(
    /ghost-btn/,
  );
  await expect(page.locator('.overlay-focus-card [data-action="continue-gems"]')).toHaveCount(1);
  await expect(page.locator('.fail-offer-card[data-offer-id="gem_pack_s"]')).toHaveCount(0);

  await page.click('.overlay-focus-card [data-action="continue-gems"]');

  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator(".overlay-modal")).toHaveCount(0);
});

test("fail rescue purchase promotes gem continue even for rewarded-primary players", async ({
  page,
}) => {
  await openDebugShell(page);
  await seedDebugFailProfile(page, {
    levelId: 24,
    gems: 0,
    rewardedViews: 0,
    piggyBankGold: 0,
    failVariant: "rewarded_primary",
  });
  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();
  await dismissDailyReward(page);
  await forceDebugFail(page, 24);

  await expect(page.locator(".overlay-focus-card")).toContainText("Watch Ad + Moves");
  const rescueCard = page.locator('.fail-offer-card[data-offer-id="gem_pack_s"]');
  await rescueCard.locator('[data-action="purchase-offer"][data-id="gem_pack_s"]').click();

  await expect(page.locator(".reward-reveal-modal")).toHaveCount(0);
  await expect(page.locator(".fail-modal > h2")).toContainText("Recovery ready");
  await expect(page.locator(".overlay-focus-card.is-recovery-ready")).toHaveCount(1);
  await expect(page.locator(".overlay-focus-card")).toContainText("Recovery ready");
  await expect(page.locator(".overlay-focus-card")).toContainText("Continue for 12 Gems");
  await expect(page.locator(".overlay-focus-card")).toContainText("Ready now 75 Gems");
  await expect(page.locator(".overlay-focus-card")).toContainText("After continue 63 Gems");
  await expect(page.locator(".fail-secondary-note")).toContainText(
    "The free ad path is still available below if you would rather save gems.",
  );
  await expect(page.locator(".fail-modal .cta-row-stacked.is-secondary-recovery")).toHaveCount(1);
  await expect(page.locator(".fail-modal .fail-footer-row.is-secondary-exit")).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-rewarded"]')).toHaveClass(
    /ghost-btn/,
  );
  await expect(page.locator('.overlay-focus-card [data-action="continue-gems"]')).toHaveCount(1);
  await expect(page.locator('.fail-modal > .cta-row-stacked [data-action="continue-rewarded"]')).toHaveCount(1);
});

test("fail rescue retry clears recovery ready state before the next fail", async ({ page }) => {
  await openDebugShell(page);
  await seedDebugFailProfile(page, {
    levelId: 24,
    gems: 0,
    rewardedViews: 0,
    piggyBankGold: 0,
    failVariant: "rewarded_primary",
  });
  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();
  await dismissDailyReward(page);
  await forceDebugFail(page, 24);

  const rescueCard = page.locator('.fail-offer-card[data-offer-id="gem_pack_s"]');
  await rescueCard.locator('[data-action="purchase-offer"][data-id="gem_pack_s"]').click();

  await expect(page.locator(".fail-modal > h2")).toContainText("Recovery ready");
  await page.click('.fail-footer-row [data-action="restart-level"]');
  await expect(page.locator(".level-hud")).toBeVisible();

  await forceDebugFail(page, 24);

  await expect(page.locator(".fail-modal > h2")).not.toContainText("Recovery ready");
  await expect(page.locator(".overlay-focus-card.is-recovery-ready")).toHaveCount(0);
  await expect(page.locator(".fail-secondary-note")).toHaveCount(0);
  await expect(page.locator(".fail-modal .fail-footer-row.is-secondary-exit")).toHaveCount(0);
});

test("fail rescue map exit keeps momentum with a recovery spotlight on the map", async ({ page }) => {
  await openDebugShell(page);
  await seedDebugFailProfile(page, {
    levelId: 24,
    gems: 0,
    rewardedViews: 0,
    piggyBankGold: 0,
    failVariant: "rewarded_primary",
  });
  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();
  await dismissDailyReward(page);
  await forceDebugFail(page, 24);

  const rescueCard = page.locator('.fail-offer-card[data-offer-id="gem_pack_s"]');
  await rescueCard.locator('[data-action="purchase-offer"][data-id="gem_pack_s"]').click();

  await expect(page.locator(".fail-modal > h2")).toContainText("Recovery ready");
  await page.click('.fail-footer-row [data-action="acknowledge-level"]');

  const spotlight = page.locator(".spotlight-card");
  await expect(spotlight).toContainText("Recovery gems are ready");
  await expect(spotlight).toContainText("You now have more gems for continues");
  await spotlight.locator('[data-action="start-current-level"]').click();

  await expect(page.locator(".prelevel-modal")).toBeVisible();
});

test("shop keeps no ads visible after buying ad light while removing the lighter offer", async ({
  page,
}) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  await expect(page.locator(".shop-status-card")).toContainText("Standard ad mix");
  await expect(page.locator(".offer-grid")).toContainText("Ad Light");
  await expect(page.locator(".offer-grid")).toContainText("No Ads");
  await expect(page.locator(".offer-grid")).toContainText("Sticky banners");
  await expect(page.locator(".offer-grid")).toContainText("Interstitial breaks");

  await page.click('[data-action="purchase-offer"][data-id="ad_light"]');

  await expect(page.locator('[data-action="purchase-offer"][data-id="ad_light"]')).toHaveCount(0);
  await expect(page.locator(".shop-status-card")).toContainText("Ad Light active");
  await expect(page.locator(".shop-status-card")).toContainText("Upgrade to No Ads");
  await expect(page.locator(".offer-grid")).toContainText("No Ads");
  await expect(page.locator(".offer-grid")).toContainText("Upgrade");
  await expect(page.locator('.offer-card').first()).toHaveAttribute("data-offer-id", "no_ads");
  await expect(page.locator('.offer-card[data-offer-id="no_ads"]')).toContainText("Featured above");
  await expect(page.locator('.offer-card[data-offer-id="no_ads"] [data-action="purchase-offer"]')).toHaveCount(0);
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const raw = window.localStorage.getItem("bubble-kingdom:save");
        if (!raw) {
          return null;
        }

        const save = JSON.parse(raw) as {
          economy?: { adLightPurchased?: boolean; noAdsPurchased?: boolean };
        };
        return {
          adLightPurchased: save.economy?.adLightPurchased ?? false,
          noAdsPurchased: save.economy?.noAdsPurchased ?? false,
        };
      });
    })
    .toEqual({
      adLightPurchased: true,
      noAdsPurchased: false,
    });
});

test("direct no ads purchase switches the shop into a completed ad-free status", async ({
  page,
}) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  await page.click('[data-action="purchase-offer"][data-id="no_ads"]');

  const statusCard = page.locator(".shop-status-card");
  await expect(statusCard).toContainText("No Ads active");
  await expect(statusCard).toContainText("Play next level");
  await expect(statusCard).not.toContainText("Upgrade to No Ads");
  await expect(page.locator('[data-action="purchase-offer"][data-id="no_ads"]')).toHaveCount(0);
  await expect(page.locator('[data-action="purchase-offer"][data-id="ad_light"]')).toHaveCount(0);
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const raw = window.localStorage.getItem("bubble-kingdom:save");
        if (!raw) {
          return null;
        }

        const save = JSON.parse(raw) as {
          economy?: { adLightPurchased?: boolean; noAdsPurchased?: boolean };
        };
        return {
          adLightPurchased: save.economy?.adLightPurchased ?? false,
          noAdsPurchased: save.economy?.noAdsPurchased ?? false,
        };
      });
    })
    .toEqual({
      adLightPurchased: true,
      noAdsPurchased: true,
    });

  await statusCard.locator('[data-action="start-current-level"]').click();
  await expect(page.locator(".prelevel-modal")).toBeVisible();
  await expect(page.locator(".prelevel-modal")).toContainText("Play 1");
  await page.click('[data-action="confirm-start-level"]');
  await expect(page.locator(".level-hud")).toBeVisible();
  await expect(page.locator(".overlay-modal")).toHaveCount(0);
});

test("ad light upgrade CTA on the status card completes the no ads purchase", async ({
  page,
}) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  await page.click('[data-action="purchase-offer"][data-id="ad_light"]');

  const statusCard = page.locator(".shop-status-card");
  await expect(statusCard).toHaveAttribute("data-shop-status-mode", "ad_light");

  await statusCard.locator('[data-action="purchase-offer"][data-id="no_ads"]').click();

  await expect(statusCard).toHaveAttribute("data-shop-status-mode", "no_ads");
  await expect(statusCard).toContainText("No Ads active");
  await expect(statusCard).toContainText("Play next level");
  await expect(statusCard.locator('[data-action="purchase-offer"]')).toHaveCount(0);
  await expect(page.locator('.offer-card[data-offer-id="no_ads"]')).toHaveCount(0);
});

test("claiming the daily reward leaves one clear next-step spotlight on the map", async ({ page }) => {
  const claimButton = page.locator('[data-action="claim-daily"]');
  await expect(claimButton).toBeVisible();

  await claimButton.click();

  await expect(page.locator(".hero-panel > .goal-card")).toHaveCount(1);
  await expect(page.locator(".hero-panel > .goal-card:not(.spotlight-card)")).toHaveCount(0);
  await expect(page.locator(".spotlight-card")).toContainText("Blossom Gardens");
  await expect(page.locator(".spotlight-card")).toContainText("Play");
  await expect(page.locator(".hero-panel > .cta-row").first().locator(".primary-btn")).toHaveCount(0);
  await expect(page.locator(".level-preview-card")).toContainText("Featured above");
  await expect(page.locator(".level-preview-card .cta-row button")).toHaveCount(0);
  await expect(page.locator(".event-summary-panel")).toContainText("Featured above");
  await expect(page.locator(".event-summary-panel .cta-row button")).toHaveCount(0);
});

test("daily rewards screen becomes a tomorrow teaser after today's reward is collected", async ({ page }) => {
  const claimButton = page.locator('[data-action="claim-daily"]');
  await expect(claimButton).toBeVisible();
  await claimButton.click();

  await page.click('[data-action="open-screen"][data-id="dailyRewards"]');

  const dailyScreen = page.locator(".daily-rewards-screen");
  await expect(dailyScreen).toContainText("Come back tomorrow");
  await expect(dailyScreen).toContainText("Tomorrow");
  await expect(page.locator('[data-action="claim-daily"]')).toHaveCount(0);
  await expect(page.locator(".daily-reward-card.is-up-next")).toContainText("Tomorrow");
  await expect(page.locator(".daily-reward-card.is-claimed-today")).toContainText("Claimed today");
});

test("claiming the daily reward can spotlight an affordable restoration and suppress duplicate restore CTAs", async ({ page }) => {
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding daily restore spotlight test.");
    }

    const save = JSON.parse(raw) as {
      progression: { starsByLevel: Record<string, number> };
    };
    save.progression.starsByLevel["1"] = 3;
    save.progression.starsByLevel["2"] = 3;
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  const claimButton = page.locator('[data-action="claim-daily"]');
  await expect(claimButton).toBeVisible();
  await claimButton.click();

  const restorePanel = page.locator(".side-stack .panel").filter({
    has: page.locator(".restoration-grid"),
  });
  await expect(page.locator('.spotlight-card [data-action="restore-node"]')).toHaveCount(1);
  await expect(page.locator(".spotlight-card")).toContainText("Restore Area");
  await expect(page.locator(".level-preview-card")).toContainText("Featured above");
  await expect(page.locator(".level-preview-card .cta-row button")).toHaveCount(0);
  await expect(page.locator(".event-summary-panel")).toContainText("Featured above");
  await expect(page.locator(".event-summary-panel .cta-row button")).toHaveCount(0);
  await expect(page.locator(".restoration-card.is-spotlight-target")).toContainText("Featured above");
  await expect(page.locator(".restoration-card.is-spotlight-target button")).toHaveCount(0);
  await expect(restorePanel).toContainText("Featured above");
  await expect(restorePanel.locator('[data-action="open-screen"][data-id="restoration"]')).toHaveCount(0);
});

test("claiming a quest refreshes the map spotlight to the next best restoration action", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding quest spotlight test.");
    }

    const nowIso = new Date().toISOString();
    const save = JSON.parse(raw) as {
      progression: {
        lastDailyRewardAt: string | null;
        dailyRewardDay: number;
        starsByLevel: Record<string, number>;
      };
      quests: Record<
        string,
        {
          progress: number;
          claimed: boolean;
          cadence: "daily" | "weekly";
          lastUpdatedAt: string;
        }
      >;
    };
    save.progression.lastDailyRewardAt = nowIso;
    save.progression.dailyRewardDay = 1;
    save.progression.starsByLevel["1"] = 3;
    save.progression.starsByLevel["2"] = 3;
    save.quests.daily_complete_3 = {
      progress: 3,
      claimed: false,
      cadence: "daily",
      lastUpdatedAt: nowIso,
    };
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await expect(
    page.locator('.spotlight-card [data-action="claim-quest"][data-id="daily_complete_3"]'),
  ).toHaveCount(1);

  await page.click('[data-action="open-screen"][data-id="quests"]');
  await expect(page.locator(".overlay-focus-card")).toContainText("Clear 3 levels");
  await expect(
    page.locator('.overlay-focus-card [data-action="claim-quest"][data-id="daily_complete_3"]'),
  ).toHaveCount(1);
  await expect(page.locator(".quest-card.is-highlighted")).toContainText("Recommended");
  await expect(page.locator(".quest-card.is-highlighted")).toContainText("Clear 3 levels");
  await expect(page.locator(".quest-card.is-highlighted")).toContainText("Featured above");
  await expect(page.locator('.quest-card.is-highlighted [data-action="claim-quest"]')).toHaveCount(0);
  await page.locator('.overlay-focus-card [data-action="claim-quest"]').click();
  await expect(page.locator(".overlay-focus-card")).toContainText("Royal Gardens");
  await expect(page.locator('.overlay-focus-card [data-action="open-screen"][data-id="map"]')).toHaveCount(1);
  await page.click('.overlay-focus-card [data-action="open-screen"][data-id="map"]');

  await expect(page.locator('.spotlight-card [data-action="claim-quest"]')).toHaveCount(0);
  await expect(page.locator('.spotlight-card [data-action="restore-node"]')).toHaveCount(1);
  await expect(page.locator(".spotlight-card")).toContainText("Royal Gardens");
  await expect(page.locator(".restoration-card.is-spotlight-target")).toContainText("Featured above");
});

test("inbox screen keeps the comeback reward highlighted as the recommended claim", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding inbox spotlight test.");
    }

    const now = Date.now();
    const save = JSON.parse(raw) as {
      profile: { lastSessionAt: string };
      progression: { lastDailyRewardAt: string | null; dailyRewardDay: number };
    };
    save.profile.lastSessionAt = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    save.progression.lastDailyRewardAt = new Date(now).toISOString();
    save.progression.dailyRewardDay = 1;
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await page.click('[data-action="open-screen"][data-id="inbox"]');

  await expect(page.locator(".overlay-focus-card")).toContainText("Welcome back reward");
  await expect(page.locator('.overlay-focus-card [data-action="claim-inbox"]')).toHaveCount(1);
  await expect(page.locator(".inbox-card.is-highlighted")).toContainText("Recommended");
  await expect(page.locator(".inbox-card.is-highlighted")).toContainText("Featured above");
  await expect(page.locator(".inbox-card.is-highlighted [data-action=\"claim-inbox\"]")).toHaveCount(0);

  await page.locator('.overlay-focus-card [data-action="claim-inbox"]').click();
  await expect(page.locator(".overlay-focus-card")).toContainText("Blossom Gardens");
  await expect(page.locator('.overlay-focus-card [data-action="open-screen"][data-id="map"]')).toHaveCount(1);
});

test("starter pack purchase lifts a reward reveal that returns the player to the next level", async ({
  page,
}) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  const starterPack = page.locator('.offer-card[data-offer-id="starter_pack"]');
  await expect(starterPack).toBeVisible();

  await starterPack.locator('[data-action="purchase-offer"][data-id="starter_pack"]').click();

  await expect(page.locator(".reward-reveal-modal")).toContainText("Starter Pack");
  await expect(page.locator(".reward-reveal-modal")).toContainText("120 Gems");
  await expect(page.locator(".reward-reveal-modal")).toContainText("3 Bomb");
  await expect(page.locator(".overlay-focus-card")).toContainText("Play next level");
  await expect(page.locator('.overlay-focus-card [data-action="reward-reveal-primary"]')).toHaveCount(1);

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

  await page.click('.overlay-focus-card [data-action="reward-reveal-primary"]');
  await expect(page.locator(".prelevel-modal")).toBeVisible();
  await expect(page.locator(".prelevel-modal")).toContainText("Play 1");
});

test("booster pack purchase highlights the next level as the immediate follow-up", async ({
  page,
}) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  const boosterPack = page.locator('.offer-card[data-offer-id="booster_pack"]');
  await expect(boosterPack).toBeVisible();

  await boosterPack.locator('[data-action="purchase-offer"][data-id="booster_pack"]').click();

  await expect(page.locator(".reward-reveal-modal")).toContainText("Booster Crate");
  await expect(page.locator(".reward-reveal-modal")).toContainText("5 Aim");
  await expect(page.locator(".overlay-focus-card")).toContainText("Play next level");

  await page.click('.overlay-focus-card [data-action="reward-reveal-primary"]');
  await expect(page.locator(".prelevel-modal")).toBeVisible();
  await expect(page.locator(".prelevel-modal")).toContainText("Play 1");
});

test("large gem pack purchase frames the next level as a safer recovery run", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  const gemPack = page.locator('.offer-card[data-offer-id="gem_pack_l"]');
  await expect(gemPack).toBeVisible();

  await gemPack.locator('[data-action="purchase-offer"][data-id="gem_pack_l"]').click();

  await expect(page.locator(".reward-reveal-modal")).toContainText("Gem Pack L");
  await expect(page.locator(".reward-reveal-modal")).toContainText("420 Gems");
  await expect(page.locator(".reward-reveal-modal")).toContainText("Recovery gems are ready");
  await expect(page.locator(".overlay-focus-card")).toContainText("Play next level");

  await page.click('.overlay-focus-card [data-action="reward-reveal-primary"]');
  await expect(page.locator(".prelevel-modal")).toBeVisible();
  await expect(page.locator(".prelevel-modal")).toContainText("Play 1");
});

test("renovation pack purchase pivots the player into restoration planning", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  const renovationPack = page.locator('.offer-card[data-offer-id="renovation_pack"]');
  await expect(renovationPack).toBeVisible();

  await renovationPack.locator('[data-action="purchase-offer"][data-id="renovation_pack"]').click();

  await expect(page.locator(".reward-reveal-modal")).toContainText("Renovation Pack");
  await expect(page.locator(".reward-reveal-modal")).toContainText("1500 Gold");
  await expect(page.locator(".reward-reveal-modal")).toContainText("120 Petals");
  await expect(page.locator(".overlay-focus-card")).toContainText("Plan next restore");

  await page.click('.overlay-focus-card [data-action="reward-reveal-primary"]');
  await expect(page.locator(".restoration-progress-card")).toBeVisible();
  await expect(page.locator(".restoration-card").first()).toBeVisible();
});

test("season pass purchase pivots the player into the live event track", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="shop"]');
  const seasonPass = page.locator('.offer-card[data-offer-id="season_pass"]');
  await expect(seasonPass).toBeVisible();

  await seasonPass.locator('[data-action="purchase-offer"][data-id="season_pass"]').click();

  await expect(page.locator(".reward-reveal-modal")).toContainText("Season Pass");
  await expect(page.locator(".reward-reveal-modal")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".reward-reveal-modal")).toContainText("View Event");

  await page.click('.overlay-focus-card [data-action="reward-reveal-primary"]');
  await expect(page.locator(".modal-card")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".event-milestone-card").first()).toBeVisible();
});

test("switches language in settings and updates visible UI copy", async ({ page }) => {
  await dismissDailyReward(page);

  await page.click('[data-action="open-screen"][data-id="settings"]');
  await expect(page.locator(".settings-grid")).toBeVisible();

  await page.click('[data-action="set-language"][data-id="ru"]');
  await expect(page.locator(".settings-grid")).toContainText("Звук");

  await page.click('[data-action="set-language"][data-id="en"]');
  await expect(page.locator(".settings-grid")).toContainText("Sound");
});

test("opens the event screen and renders the live reward track", async ({ page }) => {
  await dismissDailyReward(page);

  await expect(page.locator(".event-summary-panel")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".hero-panel")).toContainText("Spring Blossom Festival");

  await page.click('[data-action="open-screen"][data-id="event"]');
  await expect(page.locator(".modal-card")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".modal-card")).toContainText("Seed Satchel");
  await expect(page.locator(".modal-card")).toContainText("Season");
});

test("event overlay lifts the claimable milestone into a single focus CTA", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding event focus test.");
    }

    const nowIso = new Date().toISOString();
    const save = JSON.parse(raw) as {
      currencies: { seasonalTokens: number };
      progression: { lastDailyRewardAt: string | null; dailyRewardDay: number; completedLevels: number[] };
      tutorial: { completed: boolean };
    };
    save.currencies.seasonalTokens = 25;
    save.progression.lastDailyRewardAt = nowIso;
    save.progression.dailyRewardDay = 1;
    save.progression.completedLevels = [1, 2];
    save.tutorial.completed = true;
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await page.click('[data-action="open-screen"][data-id="event"]');

  await expect(page.locator(".overlay-focus-card")).toContainText("Seed Satchel");
  await expect(
    page.locator('.overlay-focus-card [data-action="claim-event-reward"][data-id="spring_blossom_seed_satchel"]'),
  ).toHaveCount(1);
  await expect(page.locator(".event-milestone-card.is-highlighted")).toContainText("Featured above");
  await expect(
    page.locator('.event-milestone-card.is-highlighted [data-action="claim-event-reward"]'),
  ).toHaveCount(0);

  await page.locator('.overlay-focus-card [data-action="claim-event-reward"]').click();
  await expect(page.locator(".reward-reveal-modal")).toContainText("Seed Satchel");
});

test("restoration reveal guides the player to the next restoration target", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding restoration test.");
    }

    const save = JSON.parse(raw) as {
      currencies: { gold: number; petals: number };
      progression: { starsByLevel: Record<string, number>; restoredNodes: string[] };
    };
    save.currencies.gold = 600;
    save.currencies.petals = 40;
    save.progression.starsByLevel["1"] = 3;
    save.progression.starsByLevel["2"] = 3;
    save.progression.restoredNodes = [];
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await expect(page.locator(".brand-title")).toBeVisible();

  const spotlightRestore = page.locator('.spotlight-card [data-action="restore-node"]').first();
  if ((await spotlightRestore.count()) > 0) {
    await spotlightRestore.click();
  } else {
    await page.click('[data-action="open-screen"][data-id="restoration"]');
    await expect(page.locator(".modal-card")).toContainText("Blossom Gardens");
    await page
      .locator(".overlay-modal .restoration-card")
      .first()
      .locator('[data-action="restore-node"]')
      .click({ force: true });
  }
  await expect(page.locator(".reward-reveal-modal")).toContainText("Chapter progress");
  await expect(page.locator(".reward-reveal-modal")).toContainText("Next target");

  await page.click('[data-action="reward-reveal-primary"]');
  await expect(page.locator(".modal-card")).toContainText("Blossom Gardens");
  await expect(page.locator(".modal-card")).toContainText("Crystal Fountain");
});

test("restoration overlay lifts the recommended upgrade into a single focus CTA", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding restoration focus test.");
    }

    const save = JSON.parse(raw) as {
      currencies: { gold: number; petals: number };
      progression: { starsByLevel: Record<string, number>; lastDailyRewardAt: string | null; dailyRewardDay: number };
    };
    save.currencies.gold = 600;
    save.currencies.petals = 40;
    save.progression.lastDailyRewardAt = new Date().toISOString();
    save.progression.dailyRewardDay = 1;
    save.progression.starsByLevel["1"] = 3;
    save.progression.starsByLevel["2"] = 3;
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await expect(page.locator('.spotlight-card [data-action="restore-node"]')).toHaveCount(1);
  await page.locator('.spotlight-card [data-action="restore-node"]').click();
  await expect(page.locator(".reward-reveal-modal")).toContainText("Royal Gardens");
  await page.click('[data-action="reward-reveal-primary"]');

  await expect(page.locator(".overlay-focus-card")).toContainText("Crystal Fountain");
  await expect(page.locator('.overlay-focus-card [data-action="restore-node"]')).toHaveCount(1);
  await expect(page.locator(".restoration-card.is-highlighted")).toContainText("Featured above");
  await expect(page.locator('.restoration-card.is-highlighted [data-action="restore-node"]')).toHaveCount(0);
});

test("chapter chest follow-up persists on the map until the player opens the featured event", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding chapter chest test.");
    }

    const save = JSON.parse(raw) as {
      progression: { starsByLevel: Record<string, number> };
    };
    for (let levelId = 1; levelId <= 10; levelId += 1) {
      save.progression.starsByLevel[String(levelId)] = 3;
    }
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await expect(page.locator(".chapter-chest-card")).toContainText("Chapter chest ready");

  await page.click('[data-action="claim-chapter-chest"]');
  await expect(page.locator(".reward-reveal-modal")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".reward-reveal-modal")).toContainText("Event spotlight");
  await expect(page.locator(".reward-reveal-modal .overlay-focus-card")).toContainText("View Event");
  await expect(page.locator(".reward-reveal-modal > .cta-row [data-action=\"reward-reveal-primary\"]")).toHaveCount(0);
  await expect(page.locator(".reward-reveal-modal > .cta-row [data-action=\"dismiss-reward-reveal\"]")).toHaveCount(1);

  await page.click('[data-action="dismiss-reward-reveal"]');
  await expect(page.locator(".spotlight-card")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".spotlight-card")).toContainText("View Event");
  await expect(page.locator(".notice-chip-row .notice-chip", { hasText: "Event" })).toHaveCount(0);
  await expect(page.locator(".event-summary-panel")).toContainText("Featured above");
  await expect(page.locator(".event-summary-panel .cta-row button")).toHaveCount(0);

  await page.locator(".spotlight-card").locator('[data-action="open-screen"][data-id="event"]').click();
  await expect(page.locator(".modal-card")).toContainText("Spring Blossom Festival");
  await expect(page.locator(".modal-card")).toContainText("Seed Satchel");
});

test("chapter unlock reveal spotlights the next zone on map entry", async ({ page }) => {
  await dismissDailyReward(page);

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("bubble-kingdom:save");
    if (!raw) {
      throw new Error("Expected save to exist before seeding chapter unlock test.");
    }

    const save = JSON.parse(raw) as {
      progression: { currentLevelId: number; lastDailyRewardAt: string | null };
      tutorial: { seenSteps: string[] };
      profile: { lastSessionAt: string };
    };
    save.progression.currentLevelId = 51;
    save.progression.lastDailyRewardAt = new Date().toISOString();
    save.profile.lastSessionAt = new Date().toISOString();
    save.tutorial.seenSteps = save.tutorial.seenSteps.filter(
      (key) => key !== "chapter_unlock:chapter_moonlit_courtyard",
    );
    window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
  });

  await page.reload();
  await expect(page.locator(".reward-reveal-modal")).toContainText("Moonlit Courtyard");
  await expect(page.locator(".reward-reveal-modal")).toContainText("First landmark");
  await expect(page.locator(".reward-reveal-modal")).toContainText("Royal Gardens");
  await expect(page.locator(".reward-reveal-modal .overlay-focus-card")).toContainText("Start new chapter");

  await page.click('[data-action="reward-reveal-primary"]');
  await expect(page.locator(".prelevel-modal")).toBeVisible();
  await expect(page.locator(".prelevel-modal")).toContainText("Play 51");
});

async function dismissDailyReward(page: Page) {
  const claimButton = page.locator('[data-action="claim-daily"]');
  if ((await claimButton.count()) > 0) {
    await claimButton.click();
    await expect(claimButton).toBeHidden();
  }
}

async function openDebugShell(page: Page) {
  await page.goto("/?debug=1");
  await expect(page.locator(".brand-title")).toBeVisible();
}

async function seedDebugFailProfile(
  page: Page,
  input: {
    levelId: number;
    gems: number;
    rewardedViews: number;
    piggyBankGold: number;
    failVariant: "rewarded_primary" | "gems_primary" | "piggy_primary";
  },
) {
  await page.evaluate(
    ({ levelId, gems, rewardedViews, piggyBankGold, failVariant }) => {
      const raw = window.localStorage.getItem("bubble-kingdom:save");
      if (!raw) {
        throw new Error("Expected save to exist before seeding debug fail profile.");
      }

      const nowIso = new Date().toISOString();
      const save = JSON.parse(raw) as {
        profile: { lastSessionAt: string };
        progression: {
          currentLevelId: number;
          lastDailyRewardAt: string | null;
          dailyRewardDay: number;
        };
        currencies: { gems: number };
        economy: { rewardedViews: number; piggyBankGold: number };
        experiments: Record<string, string>;
        tutorial: { completed: boolean };
      };

      save.profile.lastSessionAt = nowIso;
      save.progression.currentLevelId = levelId;
      save.progression.lastDailyRewardAt = nowIso;
      save.progression.dailyRewardDay = 1;
      save.currencies.gems = gems;
      save.economy.rewardedViews = rewardedViews;
      save.economy.piggyBankGold = piggyBankGold;
      save.experiments.fail_offer_variant = failVariant;
      save.tutorial.completed = true;

      window.localStorage.setItem("bubble-kingdom:save", JSON.stringify(save));
    },
    input,
  );
}

async function forceDebugWin(page: Page, levelId: number) {
  await page.evaluate(async ({ levelId: nextLevelId }) => {
    const debug = (
      window as Window & {
        __bubbleKingdomDebug?: { forceWin(levelId?: number): Promise<void> };
      }
    ).__bubbleKingdomDebug;
    if (!debug) {
      throw new Error("Expected debug harness to be available.");
    }

    await debug.forceWin(nextLevelId);
  }, { levelId });
}

async function forceDebugFail(page: Page, levelId: number) {
  await page.evaluate(async ({ levelId: nextLevelId }) => {
    const debug = (
      window as Window & {
        __bubbleKingdomDebug?: { forceFail(levelId?: number): Promise<void> };
      }
    ).__bubbleKingdomDebug;
    if (!debug) {
      throw new Error("Expected debug harness to be available.");
    }

    await debug.forceFail(nextLevelId);
  }, { levelId });
}
