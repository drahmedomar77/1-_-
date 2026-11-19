import type { ReactElement } from "react";

/** AdMob is a native-only integration; Expo web previews intentionally render no ads. */
export function NativeAdBanner(): ReactElement | null {
  return null;
}
export async function initializeAds(): Promise<boolean> {
  return false;
}
export async function openPrivacyOptions(): Promise<boolean> {
  return false;
}
export async function showInterstitialAtBreak(): Promise<void> {}
export async function showRewardedForLife(): Promise<boolean> {
  return false;
}
