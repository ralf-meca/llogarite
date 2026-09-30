import { HandPalmIcon, QrCodeIcon } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';

// A creased receipt is the usual reason a QR will not read, and nothing on the
// scanner said so. Two hands press inward and the paper widens and squares up:
// curled paper reads as narrower and skewed, so un-skewing it is what "flat"
// looks like from the camera's side.
//
// Transforms and opacity only, so the whole thing runs on the native driver and
// costs nothing while the camera is working.
const PRESS_MS = 520;
const HOLD_MS = 620;
const HAND_TRAVEL = 9;

export function FlattenReceiptHint() {
  const { t } = useTranslation();
  const press = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(press, {
          toValue: 1,
          duration: PRESS_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_MS),
        Animated.timing(press, {
          toValue: 0,
          duration: PRESS_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [press]);

  const leftHand = press.interpolate({ inputRange: [0, 1], outputRange: [-HAND_TRAVEL, 0] });
  const rightHand = press.interpolate({ inputRange: [0, 1], outputRange: [HAND_TRAVEL, 0] });
  const flatten = press.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const straighten = press.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '0deg'] });

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.stage}>
        <Animated.View style={{ transform: [{ translateX: leftHand }] }}>
          <HandPalmIcon size={26} weight="fill" color={colors.white} />
        </Animated.View>

        <Animated.View
          style={[styles.paper, { transform: [{ rotate: straighten }, { scaleX: flatten }] }]}
        >
          <QrCodeIcon size={28} weight="regular" color={colors.textDark} />
        </Animated.View>

        {/* Mirrored rather than a second icon, so both hands are the same shape. */}
        <Animated.View style={{ transform: [{ translateX: rightHand }, { scaleX: -1 }] }}>
          <HandPalmIcon size={26} weight="fill" color={colors.white} />
        </Animated.View>
      </View>

      <Text style={styles.caption}>{t('qrScanner.flattenHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paper: {
    width: 46,
    height: 58,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    // The camera behind this is whatever the user is pointing at, so the text
    // needs to carry its own contrast.
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
