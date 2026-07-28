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

export async function purchasePremium(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}

export async function restorePurchases(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}
