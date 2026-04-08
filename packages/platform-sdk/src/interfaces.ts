import type {
  LanguageCode,
  LeaderboardEntry,
  PlatformTarget,
  SessionInfo,
} from "@bubble-kingdom/shared";
import type { AnalyticsEventName } from "@bubble-kingdom/analytics";
import type { RemoteConfig } from "@bubble-kingdom/config";

export interface PlatformProduct {
  id: string;
  title: string;
  description: string;
  imageUri?: string;
  price: string;
  priceValue?: string;
  priceCurrencyCode?: string;
  currencyIconUri?: string;
}

export interface PurchaseReceipt {
  productId: string;
  purchaseToken?: string;
  developerPayload?: string;
}

export interface AdOutcome {
  shown: boolean;
  rewarded?: boolean;
  reason?: string;
}

export interface PlatformIdentity {
  anonymousId: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
  authenticated: boolean;
}

export interface IPlatformAuth {
  getIdentity(): Promise<PlatformIdentity>;
  promptLogin(reason: string): Promise<PlatformIdentity>;
  canPromptLogin(): Promise<boolean>;
}

export interface IPlatformAds {
  showInterstitial(reason: string): Promise<AdOutcome>;
  showRewarded(reason: string): Promise<AdOutcome>;
  setStickyBannerVisible(visible: boolean): Promise<boolean>;
}

export interface IPlatformPurchases {
  getCatalog(): Promise<PlatformProduct[]>;
  purchase(productId: string, developerPayload?: string): Promise<PurchaseReceipt | null>;
  getPendingPurchases(): Promise<PurchaseReceipt[]>;
  consumePurchase?(purchaseToken: string): Promise<void>;
}

export interface IPlatformStorage {
  load(key: string): Promise<string | null>;
  save(key: string, value: string): Promise<void>;
}

export interface IPlatformCloudSave {
  isAvailable(): Promise<boolean>;
  loadCloud(key: string): Promise<string | null>;
  saveCloud(key: string, value: string): Promise<void>;
}

export interface IPlatformLeaderboards {
  getEntries(boardId: string): Promise<LeaderboardEntry[]>;
  submitScore(boardId: string, score: number, extraData?: string): Promise<boolean>;
}

export interface IPlatformLocale {
  getLanguage(): Promise<LanguageCode>;
}

export interface IPlatformServerTime {
  now(): Promise<number>;
}

export interface IPlatformAnalytics {
  track(name: AnalyticsEventName, payload?: Record<string, unknown>): Promise<void>;
}

export interface IPlatformRemoteConfig {
  getRemoteConfig(clientFeatures?: Record<string, string>): Promise<RemoteConfig>;
}

export interface IPlatformLogging {
  capture(level: "debug" | "info" | "warn" | "error", message: string): Promise<void>;
}

export interface IPlatformLifecycle {
  markLoadingReady(): Promise<void>;
  startGameplay(): Promise<void>;
  stopGameplay(): Promise<void>;
}

export interface PlatformAdapter {
  target: PlatformTarget;
  session: SessionInfo;
  auth: IPlatformAuth;
  ads: IPlatformAds;
  purchases: IPlatformPurchases;
  storage: IPlatformStorage;
  cloudSave: IPlatformCloudSave;
  leaderboards: IPlatformLeaderboards;
  locale: IPlatformLocale;
  serverTime: IPlatformServerTime;
  analytics: IPlatformAnalytics;
  remoteConfig: IPlatformRemoteConfig;
  logging: IPlatformLogging;
  lifecycle: IPlatformLifecycle;
  boot(): Promise<void>;
}
