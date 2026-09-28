import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

// The live unit only in a release build. A dev build keeps Google's sample unit
// so a reloading Metro session cannot pour requests into the real one.
const AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-3717243561831400/9138753257';

// Devices listed here are served test creatives from the live unit. This app is
// tested on release builds, where __DEV__ is false, so without this the test
// phone generates real impressions on the account - which AdMob counts as
// invalid traffic and suspends accounts over. The SDK prints the id to add on
// its first ad request:
//   "Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("..."))"
const TEST_DEVICE_IDS: string[] = [
  'FEDD6C314E2218E146A820BF430E1637', // the Samsung this app is tested on
];

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
  // The allowlist has to be in place before the first request, or that request
  // is a live one.
  return mobileAds()
    .setRequestConfiguration({ testDeviceIdentifiers: TEST_DEVICE_IDS })
    .then(() => mobileAds().initialize())
    .then((statuses) => {
      // Strictly after initialize: the native SDK throws IllegalStateException
      // if the muted state is set before it. Still before any ad is requested,
      // since every request waits on this promise.
      //
      // The app makes no sound of its own, so an ad that suddenly does is
      // jarring. The cost is real and accepted: muting narrows video ad
      // eligibility, which is the better paying inventory.
      mobileAds().setAppMuted(true);
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
