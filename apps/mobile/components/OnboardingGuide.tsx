import { CrownIcon, XIcon } from 'phosphor-react-native';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { FAB_BOTTOM_OFFSET, FAB_SIZE, colors, radius } from '../lib/theme';
import { AccountantMascot } from './AccountantMascot';

export type OnboardingStep = {
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  premium?: boolean;
  highlightFab?: boolean;
};

const FAB_RADIUS = FAB_SIZE / 2;
const SPOTLIGHT_RADIUS = FAB_RADIUS + 14;

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
  const insets = useSafeAreaInsets();
  const isLast = stepIndex === totalSteps - 1;
  const { width, height } = Dimensions.get('window');
  const fabCenterX = width / 2;
  const fabCenterY = height - FAB_BOTTOM_OFFSET - insets.bottom - FAB_RADIUS;

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
              <XIcon size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.bubbleHeader}>
              {/* Ahead of the title: after it, a title that wraps pushed the crown under the close button. */}
              {step.premium && <CrownIcon size={18} weight="fill" color={colors.primary} />}
              <Text style={styles.bubbleTitle}>{t(step.titleKey)}</Text>
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

          <AccountantMascot size={108} />
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
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 10,
  },
  // Takes all the width the mascot leaves: the text is the point of the thing.
  bubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  bubbleTail: {
    position: 'absolute',
    top: 26,
    right: -8,
    width: 16,
    height: 16,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '-45deg' }],
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 34,
  },
  bubbleTitle: {
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '700',
    color: colors.textDark,
  },
  bubbleMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  backButtonText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});
