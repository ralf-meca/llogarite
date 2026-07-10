import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { redeemDiscountCode } from '../lib/discountCodesApi';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

const PREMIUM_MONTHLY_PRICE = 5;

type PlansScreenProps = {
  isPremium: boolean;
  onBack: () => void;
  onPremiumGranted: () => void;
};

type FeatureRowProps = {
  label: string;
  included: boolean;
};

function FeatureRow({ label, included }: FeatureRowProps) {
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={included ? 'checkmark-circle' : 'close-circle-outline'}
        size={16}
        color={included ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.featureLabel, !included && styles.featureLabelDisabled]}>{label}</Text>
    </View>
  );
}

export function PlansScreen({ isPremium, onBack, onPremiumGranted }: PlansScreenProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const { toasts, showError, showSuccess, dismissToast } = useToasts();

  const handleApplyCode = () => {
    if (!code.trim()) {
      return;
    }
    setIsRedeeming(true);
    redeemDiscountCode(code.trim())
      .then((result) => {
        setIsRedeeming(false);
        setDiscountPercent(result.discountPercent);
        if (result.isPremium) {
          showSuccess(t('plans.premiumActivated'));
          onPremiumGranted();
        } else {
          showSuccess(t('plans.codeApplied', { percent: result.discountPercent }));
        }
      })
      .catch((error: Error) => {
        setIsRedeeming(false);
        showError(error.message);
      });
  };

  const discountedPrice =
    discountPercent !== null ? Math.round(PREMIUM_MONTHLY_PRICE * (1 - discountPercent / 100) * 100) / 100 : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </Pressable>
        <Text style={styles.title}>{t('plans.title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.plansRow}>
          <GlassView style={styles.planCard}>
            <Text style={styles.planName}>{t('plans.freePlan')}</Text>
            <Text style={styles.planPrice}>0€</Text>
            <Text style={styles.planPeriod}>{t('plans.forever')}</Text>
            <View style={styles.featureList}>
              <FeatureRow label={t('plans.featureScanSave')} included />
              <FeatureRow label={t('plans.featureBudget')} included />
              <FeatureRow label={t('plans.featureProjects')} included={false} />
              <FeatureRow label={t('plans.featurePrices')} included={false} />
              <FeatureRow label={t('plans.featureBuddies')} included={false} />
              <FeatureRow label={t('plans.featureNoAds')} included={false} />
            </View>
          </GlassView>

          <View style={styles.planCardPremiumWrapper}>
            <View style={styles.premiumBadge}>
              <MaterialCommunityIcons name="crown" size={13} color={colors.white} />
              <Text style={styles.premiumBadgeText}>{t('plans.premiumPlan')}</Text>
            </View>
            <GlassView style={[styles.planCard, styles.planCardPremium]}>
              <Text style={styles.planName}>{t('plans.premiumPlan')}</Text>
              <Text style={styles.planPrice}>
                {discountedPrice ?? PREMIUM_MONTHLY_PRICE}€
                {discountedPrice !== null && discountedPrice !== PREMIUM_MONTHLY_PRICE && (
                  <Text style={styles.planPriceOriginal}> {PREMIUM_MONTHLY_PRICE}€</Text>
                )}
              </Text>
              <Text style={styles.planPeriod}>{t('plans.perMonth')}</Text>
              <View style={styles.featureList}>
                <FeatureRow label={t('plans.featureEverythingFree')} included />
                <FeatureRow label={t('plans.featureProjects')} included />
                <FeatureRow label={t('plans.featurePrices')} included />
                <FeatureRow label={t('plans.featureBuddies')} included />
                <FeatureRow label={t('plans.featureNoAds')} included />
              </View>

              {isPremium ? (
                <View style={styles.activeBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.activeBadgeText}>{t('plans.currentPlan')}</Text>
                </View>
              ) : (
                <GlassButton
                  label={t('plans.buyPremium')}
                  variant="accent"
                  style={styles.buyButton}
                  onPress={() => showError(t('plans.paymentsComingSoon'))}
                />
              )}
            </GlassView>
          </View>
        </View>

        {!isPremium && (
          <GlassView style={styles.codeCard}>
            <Text style={styles.codeTitle}>{t('plans.haveReferralCode')}</Text>
            <View style={styles.codeRow}>
              <GlassTextInput
                style={styles.codeInput}
                placeholder={t('plans.codePlaceholder')}
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
              />
              <GlassButton
                label={isRedeeming ? '...' : t('plans.apply')}
                variant="accent"
                style={styles.codeButton}
                onPress={handleApplyCode}
                disabled={isRedeeming || !code.trim()}
              />
            </View>
          </GlassView>
        )}
      </ScrollView>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
  },
  scroll: {
    flex: 1,
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 16,
  },
  plansRow: {
    flexDirection: 'column',
    gap: 24,
  },
  planCard: {
    padding: 16,
  },
  planCardPremiumWrapper: {
    position: 'relative',
  },
  planCardPremium: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  premiumBadge: {
    position: 'absolute',
    top: -10,
    left: 16,
    zIndex: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  planName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 8,
  },
  planPriceOriginal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  planPeriod: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
  },
  featureLabelDisabled: {
    color: colors.textMuted,
  },
  buyButton: {
    marginTop: 16,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  codeCard: {
    padding: 20,
  },
  codeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
  },
  codeButton: {
    paddingHorizontal: 20,
  },
});
