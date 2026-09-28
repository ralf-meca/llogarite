import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = TestIds.INTERSTITIAL;

// An interstitial has to be fetched over the network before it can be shown,
// which takes seconds. Loading one at the moment it is wanted puts that wait
// between the user and the ad, so one is kept loaded ahead of time and the
// request only ever costs a show() call.
type AdState = 'idle' | 'loading' | 'ready';

let hasInitialized = false;
let state: AdState = 'idle';
let interstitial: InterstitialAd | null = null;

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

// An InterstitialAd instance is single use: once shown it can never hold
// another ad, so every one is replaced as soon as it closes.
function loadNext(): void {
  const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID);
  interstitial = ad;
  state = 'loading';

  const unsubscribe = () => {
    unsubscribeLoaded();
    unsubscribeError();
    unsubscribeClosed();
  };

  const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    if (interstitial === ad) {
      state = 'ready';
    }
  });
  const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    unsubscribe();
    loadNext();
  });
  // Left idle rather than retried on the spot: a failing request usually keeps
  // failing, and the next save asks again anyway.
  const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
    console.warn('[ads] interstitial failed to load', JSON.stringify(error));
    if (interstitial === ad) {
      interstitial = null;
      state = 'idle';
    }
    unsubscribe();
  });

  ad.load();
}

export function preloadInterstitialAd(): void {
  if (state !== 'idle') {
    return;
  }
  ensureInitialized()
    .then(() => {
      if (state === 'idle') {
        loadNext();
      }
    })
    .catch((error) => {
      console.warn('[ads] mobileAds().initialize() failed', error);
    });
}

export function showInterstitialAd(): void {
  if (state !== 'ready' || !interstitial) {
    // Nothing loaded yet. Skipping costs one impression; waiting would cost the
    // user a stall on a screen they have already finished with.
    preloadInterstitialAd();
    return;
  }

  const ad = interstitial;
  state = 'idle';
  ad.show().catch((error) => {
    console.warn('[ads] ad.show() failed', error);
    loadNext();
  });
}
