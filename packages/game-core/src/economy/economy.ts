import type { RewardGrant, ShopOfferDefinition } from "@bubble-kingdom/shared";
import type { RemoteConfig } from "@bubble-kingdom/config";

import type { PlayerSave } from "../save/schema";

export function applyRewardGrant(save: PlayerSave, reward: RewardGrant): PlayerSave {
  return {
    ...save,
    currencies: {
      gold: save.currencies.gold + (reward.gold ?? 0),
      petals: save.currencies.petals + (reward.petals ?? 0),
      gems: save.currencies.gems + (reward.gems ?? 0),
      seasonalTokens: save.currencies.seasonalTokens + (reward.seasonalTokens ?? 0),
    },
    boosters: {
      ...save.boosters,
      extraMoves:
        (save.boosters.extraMoves ?? 0) + (reward.boosters?.extraMoves ?? 0),
      rainbowOrb:
        (save.boosters.rainbowOrb ?? 0) + (reward.boosters?.rainbowOrb ?? 0),
      bombOrb:
        (save.boosters.bombOrb ?? 0) + (reward.boosters?.bombOrb ?? 0),
      precisionAim:
        (save.boosters.precisionAim ?? 0) + (reward.boosters?.precisionAim ?? 0),
      undoShot:
        (save.boosters.undoShot ?? 0) + (reward.boosters?.undoShot ?? 0),
    },
  };
}

export function spendCurrency(
  save: PlayerSave,
  currency: "gold" | "petals" | "gems" | "seasonalTokens",
  amount: number,
): PlayerSave {
  if (save.currencies[currency] < amount) {
    throw new Error(`Not enough ${currency}.`);
  }

  return {
    ...save,
    currencies: {
      ...save.currencies,
      [currency]: save.currencies[currency] - amount,
    },
  };
}

export function calculateExtraMovesGemCost(
  failCount: number,
  remoteConfig: RemoteConfig,
): number {
  return remoteConfig.economy.extraMovesGemCost + failCount * 2;
}

export function calculatePiggyBankProgress(
  save: PlayerSave,
  goldEarned: number,
  remoteConfig: RemoteConfig,
): number {
  return Math.min(remoteConfig.economy.piggyBankCap, save.economy.piggyBankGold + goldEarned);
}

export function calculatePiggyBankBonusGems(save: PlayerSave): number {
  return Math.floor(save.economy.piggyBankGold / 4);
}

export function applyShopOffer(save: PlayerSave, offer: ShopOfferDefinition): PlayerSave {
  const rewards =
    offer.type === "piggy_bank"
      ? {
          ...offer.rewards,
          gems: (offer.rewards.gems ?? 0) + calculatePiggyBankBonusGems(save),
        }
      : offer.rewards;

  let updated = applyRewardGrant(save, rewards);
  if (offer.type === "no_ads") {
    updated = {
      ...updated,
      economy: {
        ...updated.economy,
        noAdsPurchased: true,
        adLightPurchased: true,
      },
    };
  }

  if (offer.type === "piggy_bank") {
    updated = {
      ...updated,
      economy: {
        ...updated.economy,
        piggyBankGold: 0,
      },
    };
  }

  if (!updated.economy.firstPurchaseAt) {
    updated = {
      ...updated,
      economy: {
        ...updated.economy,
        firstPurchaseAt: new Date().toISOString(),
      },
    };
  }

  return updated;
}
