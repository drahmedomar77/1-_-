import { Platform } from "react-native";
import Constants from "expo-constants";
import React from "react";

type AdsSdk = {
  default: () => { initialize: () => Promise<unknown> };
  AdsConsent: {
    requestInfoUpdate: () => Promise<{
      isConsentFormAvailable?: boolean;
      canRequestAds: boolean;
    }>;
    loadAndShowConsentFormIfRequired: () => Promise<{
      isConsentFormAvailable?: boolean;
      canRequestAds: boolean;
    }>;
    showPrivacyOptionsForm: () => Promise<unknown>;
  };
  InterstitialAd: { createForAdRequest: (id: string, options?: object) => any };
  RewardedAd: { createForAdRequest: (id: string, options?: object) => any };
  BannerAd: React.ComponentType<any>;
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string };
  AdEventType: { LOADED: string; CLOSED: string; ERROR: string };
  RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
  TestIds: { BANNER: string; INTERSTITIAL: string; REWARDED: string };
};

type Unsubscribe = () => void;

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const configured = {
  appId: String(extra.admobAndroidAppId ?? ""),
  liveConfigurationComplete: extra.admobConfigured === true,
  banner: String(extra.admobBannerUnitId ?? ""),
  interstitial: String(extra.admobInterstitialUnitId ?? ""),
  rewarded: String(extra.admobRewardedUnitId ?? ""),
  useTestAds: extra.admobUseTestAds === true,
};

let sdk: AdsSdk | null = null;
let initialized = false;
let initializing: Promise<boolean> | null = null;

function canLoadNativeSdk(): boolean {
  // This native module is Android-only and isn't bundled into Expo Go.
  return Platform.OS === "android" && Constants.executionEnvironment !== "storeClient";
}

function getSdk(): AdsSdk | null {
  if (!canLoadNativeSdk()) return null;
  if (!sdk) {
    try {
      sdk = require("react-native-google-mobile-ads") as AdsSdk;
    } catch {
      return null;
    }
  }
  return sdk;
}

export function adsAreConfigured(): boolean {
  return (
    configured.useTestAds ||
    Boolean(
      configured.liveConfigurationComplete &&
      configured.appId &&
        configured.banner &&
        configured.interstitial &&
        configured.rewarded,
    )
  );
}

export async function initializeAds(): Promise<boolean> {
  if (!canLoadNativeSdk() || !adsAreConfigured()) return false;
  if (initialized) return true;
  if (initializing) return initializing;

  initializing = (async () => {
    try {
      const module = getSdk();
      if (!module) return false;
      // UMP checks regional requirements and presents its consent form when necessary.
      let consent = await module.AdsConsent.requestInfoUpdate();
      if (consent.isConsentFormAvailable) {
        consent = await module.AdsConsent.loadAndShowConsentFormIfRequired();
      }
      if (!consent.canRequestAds) return false;
      await module.default().initialize();
      initialized = true;
      return true;
    } catch {
      // Fail closed: no consent, native runtime, or network means no ad request.
      return false;
    } finally {
      initializing = null;
    }
  })();
  return initializing;
}

function unitId(format: "banner" | "interstitial" | "rewarded"): string | null {
  const module = getSdk();
  if (!module) return null;
  if (configured.useTestAds) {
    return module.TestIds[
      format.toUpperCase() as "BANNER" | "INTERSTITIAL" | "REWARDED"
    ];
  }
  return configured[format] || null;
}

export function NativeAdBanner(): React.ReactElement | null {
  if (!initialized) return null;
  const module = getSdk();
  const id = unitId("banner");
  if (!module || !id) return null;
  return React.createElement(module.BannerAd, {
    unitId: id,
    size: module.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
    requestOptions: { requestNonPersonalizedAdsOnly: true },
  });
}

export async function showInterstitialAtBreak(): Promise<void> {
  if (!initialized) return;
  const module = getSdk();
  const id = unitId("interstitial");
  if (!module || !id) return;
  const ad = module.InterstitialAd.createForAdRequest(id, {
    requestNonPersonalizedAdsOnly: true,
  });

  await new Promise<void>((resolve) => {
    let done = false;
    const subscriptions: Unsubscribe[] = [];
    const cleanup = () => {
      for (const unsubscribe of subscriptions.splice(0)) {
        try {
          unsubscribe();
        } catch {
          // A finished ad may already have removed its native listener.
        }
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      cleanup();
      resolve();
    };
    const timeout = setTimeout(finish, 15000);

    subscriptions.push(
      ad.addAdEventListener(module.AdEventType.LOADED, () => {
        try {
          void Promise.resolve(ad.show()).catch(finish);
        } catch {
          finish();
        }
      }),
      ad.addAdEventListener(module.AdEventType.CLOSED, finish),
      ad.addAdEventListener(module.AdEventType.ERROR, finish),
    );
    try {
      ad.load();
    } catch {
      finish();
    }
  });
}

export async function showRewardedForLife(): Promise<boolean> {
  if (!initialized) return false;
  const module = getSdk();
  const id = unitId("rewarded");
  if (!module || !id) return false;
  const ad = module.RewardedAd.createForAdRequest(id, {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<boolean>((resolve) => {
    let done = false;
    let earned = false;
    const subscriptions: Unsubscribe[] = [];
    const cleanup = () => {
      for (const unsubscribe of subscriptions.splice(0)) {
        try {
          unsubscribe();
        } catch {
          // A finished ad may already have removed its native listener.
        }
      }
    };
    const finish = (rewarded = earned) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      cleanup();
      resolve(rewarded);
    };
    const timeout = setTimeout(() => finish(false), 20000);

    subscriptions.push(
      ad.addAdEventListener(module.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(module.RewardedAdEventType.LOADED, () => {
        try {
          void Promise.resolve(ad.show()).catch(() => finish(false));
        } catch {
          finish(false);
        }
      }),
      ad.addAdEventListener(module.AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(module.AdEventType.ERROR, () => finish(false)),
    );
    try {
      ad.load();
    } catch {
      finish(false);
    }
  });
}

export async function openPrivacyOptions(): Promise<boolean> {
  if (!initialized) return false;
  const module = getSdk();
  if (!module) return false;
  try {
    const consent = await module.AdsConsent.requestInfoUpdate();
    if (!consent.isConsentFormAvailable) return false;
    await module.AdsConsent.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}
