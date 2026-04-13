import type { RemoteConfig } from "@bubble-kingdom/config";
import type { ShopOfferDefinition } from "@bubble-kingdom/shared";

import type { PlayerSave } from "../save/schema";
import { calculateExtraMovesGemCost, calculatePiggyBankBonusGems } from "./economy";

export type FailOfferVariant = "rewarded_primary" | "gems_primary" | "piggy_primary";
export type FailOfferAction = "rewarded_continue" | "gems_continue" | "piggy_bank";

export interface FailRescueGemOfferPlan {
  offerId: string;
  gemsGranted: number;
  currentGems: number;
  gemContinueCost: number;
  shortfall: number;
  gemsAfterPurchase: number;
  leftoverAfterContinue: number;
  coversContinue: boolean;
}

export interface PiggyBankPresentation {
  offerId: string;
  fillRatio: number;
  fillPercent: number;
  storedGold: number;
  cap: number;
  bonusGems: number;
  isNudged: boolean;
  isSpotlighted: boolean;
}

export interface FailOfferDecision {
  variant: FailOfferVariant;
  gemCost: number;
  hasEnoughGems: boolean;
  primaryAction: FailOfferAction;
  piggyBank: PiggyBankPresentation | null;
  headlineKey:
    | "fail.offer.rewarded.title"
    | "fail.offer.gems.title"
    | "fail.offer.piggy.title";
  bodyKey:
    | "fail.offer.rewarded.body"
    | "fail.offer.gems.body"
    | "fail.offer.piggy.body";
}

export function getPiggyBankPresentation(
  save: PlayerSave,
  remoteConfig: RemoteConfig,
  shopOffers: Array<Pick<ShopOfferDefinition, "id" | "type">>,
): PiggyBankPresentation | null {
  const offer = shopOffers.find((item) => item.type === "piggy_bank");
  if (!offer) {
    return null;
  }

  const cap = remoteConfig.economy.piggyBankCap;
  const fillRatio = cap > 0 ? save.economy.piggyBankGold / cap : 0;

  return {
    offerId: offer.id,
    fillRatio,
    fillPercent: Math.round(fillRatio * 100),
    storedGold: save.economy.piggyBankGold,
    cap,
    bonusGems: calculatePiggyBankBonusGems(save),
    isNudged: fillRatio >= remoteConfig.economy.piggyBankNudgeRatio,
    isSpotlighted: fillRatio >= remoteConfig.economy.piggyBankSpotlightRatio,
  };
}

export function decideFailOffer(input: {
  save: PlayerSave;
  remoteConfig: RemoteConfig;
  shopOffers: Array<Pick<ShopOfferDefinition, "id" | "type">>;
  continueOffersUsed: number;
}): FailOfferDecision {
  const variant = normalizeFailOfferVariant(input.save.experiments.fail_offer_variant);
  const gemCost = calculateExtraMovesGemCost(input.continueOffersUsed, input.remoteConfig);
  const hasEnoughGems = input.save.currencies.gems >= gemCost;
  const piggyBank = getPiggyBankPresentation(input.save, input.remoteConfig, input.shopOffers);

  let primaryAction: FailOfferAction = "rewarded_continue";
  if (variant === "gems_primary") {
    if (
      hasEnoughGems &&
      input.save.progression.currentLevelId >= input.remoteConfig.economy.failOfferGemPrimaryLevel
    ) {
      primaryAction = "gems_continue";
    }
  } else if (variant === "piggy_primary") {
    if (piggyBank?.isNudged && !hasEnoughGems) {
      primaryAction = "piggy_bank";
    }
  }

  if (
    primaryAction === "rewarded_continue" &&
    piggyBank?.isSpotlighted &&
    !hasEnoughGems
  ) {
    primaryAction = "piggy_bank";
  }

  if (
    primaryAction === "rewarded_continue" &&
    hasEnoughGems &&
    input.save.progression.currentLevelId >= input.remoteConfig.economy.failOfferGemPrimaryLevel &&
    input.save.economy.rewardedViews >= 3
  ) {
    primaryAction = "gems_continue";
  }

  if (primaryAction === "gems_continue") {
    return {
      variant,
      gemCost,
      hasEnoughGems,
      primaryAction,
      piggyBank,
      headlineKey: "fail.offer.gems.title",
      bodyKey: "fail.offer.gems.body",
    };
  }

  if (primaryAction === "piggy_bank") {
    return {
      variant,
      gemCost,
      hasEnoughGems,
      primaryAction,
      piggyBank,
      headlineKey: "fail.offer.piggy.title",
      bodyKey: "fail.offer.piggy.body",
    };
  }

  return {
    variant,
    gemCost,
    hasEnoughGems,
    primaryAction,
    piggyBank,
    headlineKey: "fail.offer.rewarded.title",
    bodyKey: "fail.offer.rewarded.body",
  };
}

export function planFailRescueGemOffer(input: {
  save: PlayerSave;
  gemContinueCost: number;
  shopOffers: Array<Pick<ShopOfferDefinition, "id" | "type" | "rewards">>;
}): FailRescueGemOfferPlan | null {
  const currentGems = input.save.currencies.gems;
  if (currentGems >= input.gemContinueCost) {
    return null;
  }

  const shortfall = input.gemContinueCost - currentGems;
  const gemOffers = input.shopOffers
    .filter(
      (offer) =>
        offer.type === "gem_pack" &&
        typeof offer.rewards.gems === "number" &&
        (offer.rewards.gems ?? 0) > 0,
    )
    .sort((left, right) => (left.rewards.gems ?? 0) - (right.rewards.gems ?? 0));

  const chosen =
    gemOffers.find((offer) => (offer.rewards.gems ?? 0) >= shortfall) ??
    gemOffers[gemOffers.length - 1] ??
    null;

  if (!chosen) {
    return null;
  }

  const gemsGranted = chosen.rewards.gems ?? 0;
  const gemsAfterPurchase = currentGems + gemsGranted;
  const coversContinue = gemsAfterPurchase >= input.gemContinueCost;

  return {
    offerId: chosen.id,
    gemsGranted,
    currentGems,
    gemContinueCost: input.gemContinueCost,
    shortfall,
    gemsAfterPurchase,
    leftoverAfterContinue: Math.max(0, gemsAfterPurchase - input.gemContinueCost),
    coversContinue,
  };
}

function normalizeFailOfferVariant(value: string | undefined): FailOfferVariant {
  if (value === "gems_primary" || value === "piggy_primary") {
    return value;
  }

  return "rewarded_primary";
}
