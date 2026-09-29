import Constants from 'expo-constants';
import { Linking } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';

const PREMIUM_ENTITLEMENT_ID = 'premium';

let isConfigured = false;

export function configurePurchases(userId: string): void {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!apiKey) {
    return;
  }
  if (!isConfigured) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: userId });
    isConfigured = true;
  } else {
    Purchases.logIn(userId).catch(() => undefined);
  }
}

export async function getPremiumPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) {
    return null;
  }
  return current.availablePackages[0] ?? null;
}

const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

// An app cannot cancel a Play subscription itself - Google only accepts that
// from its own screen - so this opens it, and Play's policy expects the link to
// exist. Purchases.showManageSubscriptions() would be the tidier way to ask,
// but it throws "not available in the current platform" on Android in this SDK.
//
// Deep links to the one subscription when we can name it, and falls back to the
// list otherwise: a list the user has to read is still better than no way out.
export async function openManageSubscription(): Promise<void> {
  let url = PLAY_SUBSCRIPTIONS_URL;
  try {
    const packageName = Constants.expoConfig?.android?.package;
    // Play returns these as "product:baseplan"; the sku parameter wants the
    // product on its own.
    const productId = (await Purchases.getCustomerInfo()).activeSubscriptions[0]?.split(':')[0];
    if (packageName && productId) {
      url = `${PLAY_SUBSCRIPTIONS_URL}?sku=${productId}&package=${packageName}`;
    }
  } catch {
    // Naming the subscription is a nicety; the list still gets them there.
  }
  await Linking.openURL(url);
}

export async function purchasePremium(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}

