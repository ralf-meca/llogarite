import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { AccountantMascot } from './AccountantMascot';

export type OnboardingStep = {
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  premium?: boolean;
  highlightFab?: boolean;
};

const FAB_BOTTOM_OFFSET = 32;
const FAB_RADIUS = 28;
const SPOTLIGHT_RADIUS = 42;

type OnboardingGuideProps = {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

export function OnboardingGuide({ step, stepIndex, totalSteps, onNext, onBack, onSkip }: OnboardingGuideProps) {
  const { t } = useTranslation();
  const isLast = stepIndex === totalSteps - 1;
  const { width, height } = Dimensions.get('window');
  const fabCenterX = width / 2;
  const fabCenterY = height - FAB_BOTTOM_OFFSET - FAB_RADIUS;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {step.highlightFab ? (
        <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Defs>
            <Mask id="fabSpotlightMask">
              <Rect x={0} y={0} width={width} height={height} fill="white" />
              <Circle cx={fabCenterX} cy={fabCenterY} r={SPOTLIGHT_RADIUS} fill="black" />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="rgba(10,16,36,0.22)" mask="url(#fabSpotlightMask)" />
          <Circle
            cx={fabCenterX}
            cy={fabCenterY}
            r={SPOTLIGHT_RADIUS}
            fill="none"
            stroke={colors.white}
            strokeWidth={3}
          />
        </Svg>
      ) : (
        <View style={styles.dim} pointerEvents="none" />
      )}

      <View style={styles.cluster}>
        <View style={styles.row}>
          <View style={styles.bubble}>
            <Pressable style={styles.closeButton} onPress={onSkip} hitSlop={10}>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </Pressable>

            <View style={styles.bubbleHeader}>
              <Text style={styles.bubbleTitle}>{t(step.titleKey)}</Text>
              {step.premium && <MaterialCommunityIcons name="crown" size={14} color={colors.primary} />}
            </View>
            <Text style={styles.bubbleMessage}>{t(step.messageKey)}</Text>

            <View style={styles.dotsRow}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View key={index} style={[styles.dot, index === stepIndex && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.controlsRow}>
              {stepIndex > 0 ? (
                <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
                  <Text style={styles.backButtonText}>{t('onboarding.back')}</Text>
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}
              <Pressable onPress={onNext} style={styles.nextButton} hitSlop={8}>
                <Text style={styles.nextButtonText}>{isLast ? t('onboarding.done') : t('onboarding.next')}</Text>
              </Pressable>
            </View>

            <View style={styles.bubbleTail} />
          </View>

          <AccountantMascot size={80} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,16,36,0.22)',
  },
  cluster: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bubble: {
    flex: 1,
    maxWidth: 240,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  bubbleTail: {
    position: 'absolute',
    top: 16,
    right: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '-45deg' }],
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 22,
  },
  bubbleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  bubbleMessage: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  nextButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
});
