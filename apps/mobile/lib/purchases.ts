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

// Opens the store's own subscription screen. An app cannot cancel a Play
// subscription itself - Google only lets the user do it there - so this is the
// whole of "cancel" on Android, and Play's policy expects the link to exist.
export async function openManageSubscription(): Promise<void> {
  await Purchases.showManageSubscriptions();
}

export async function purchasePremium(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}

