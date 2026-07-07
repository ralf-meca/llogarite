import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

let hasInitialized = false;

function ensureInitialized(): Promise<void> {
  if (hasInitialized) {
    return Promise.resolve();
  }
  hasInitialized = true;
  return mobileAds()
    .initialize()
    .then(() => undefined);
}

export async function showInterstitialAd(): Promise<void> {
  await ensureInitialized().catch(() => undefined);

  const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);

  await new Promise<void>((resolve) => {
    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      unsubscribeLoaded();
      unsubscribeError();
      ad.show().catch(() => undefined);
      resolve();
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      unsubscribeLoaded();
      unsubscribeError();
      resolve();
    });
    ad.load();
  });
}
