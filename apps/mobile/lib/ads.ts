import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

let hasInitialized = false;

function ensureInitialized(): Promise<void> {
  if (hasInitialized) {
    return Promise.resolve();
  }
  hasInitialized = true;
  return mobileAds()
    .initialize()
    .then((statuses) => {
      console.log('[ads] mobileAds().initialize() resolved', statuses);
    });
}

export async function showInterstitialAd(): Promise<void> {
  await ensureInitialized().catch((error) => {
    console.warn('[ads] mobileAds().initialize() failed', error);
  });

  const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);
  console.log('[ads] calling ad.load()');

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[ads] LOADED event received');
      clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeError();
      finish();
      ad.show().catch((error) => console.warn('[ads] ad.show() failed', error));
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('[ads] ERROR event received', JSON.stringify(error));
      clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeError();
      finish();
    });
    const timeout = setTimeout(() => {
      console.warn('[ads] no LOADED/ERROR event within 8s, giving up on this attempt (listeners stay live for 30s more in case it is just slow)');
      finish();
      setTimeout(() => {
        unsubscribeLoaded();
        unsubscribeError();
      }, 30000);
    }, 8000);

    ad.load();
  });
}
