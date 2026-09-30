import { HandGrabbingIcon } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';

// A creased receipt is the usual reason a QR will not read, and nothing on the
// scanner said so. Two hands press inward and a crumpled receipt becomes a flat
// one.
//
// The two states are drawn as separate pictures and cross-faded rather than
// morphed: a path cannot be animated on the native driver, and opacity can, so
// this costs nothing while the camera is working.
const PRESS_MS = 520;
const HOLD_MS = 700;
const FADE_MS = 220;
const RESTART_MS = 320;
const HAND_TRAVEL = 6;

const PAPER_W = 46;
const PAPER_H = 58;
const HAND_SIZE = 26;
// The hands overlap the paper's edges rather than sitting beside it, so they
// read as holding it rather than gesturing at it.
const HAND_OVERLAP = 9;
const STAGE_W = PAPER_W + 2 * (HAND_SIZE - HAND_OVERLAP);

// Both long edges bow in and out - what a receipt that has been in a pocket
// looks like from the front.
const CRUMPLED =
  'M8 2 C12 8 3 13 8 19 C13 25 4 30 9 36 C14 42 5 47 9 56 L38 56 C34 48 43 43 38 37 C33 31 42 26 37 20 C32 14 41 9 38 2 Z';
const CREASES = 'M11 14 L35 18 M10 30 L36 27 M12 44 L34 47';

// Enough of a QR to be recognised as one at this size: three finder squares and
// a couple of marks. Drawing the real thing would just be noise.
function QrMarks() {
  return (
    <>
      <Rect x={14} y={20} width={7} height={7} rx={1} fill={colors.textDark} />
      <Rect x={25} y={20} width={7} height={7} rx={1} fill={colors.textDark} />
      <Rect x={14} y={31} width={7} height={7} rx={1} fill={colors.textDark} />
      <Rect x={26} y={32} width={3} height={3} fill={colors.textDark} />
      <Rect x={30} y={36} width={3} height={3} fill={colors.textDark} />
    </>
  );
}

export function FlattenReceiptHint() {
  const { t } = useTranslation();
  const press = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  // Only ever crumpled to flat. Running the press backwards to loop would show
  // a flat receipt crumpling, which is the opposite of the instruction, so the
  // reset happens while the picture is faded out.
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
        Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(press, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        Animated.delay(RESTART_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [press, fade]);

  // Outward from the middle, which is how paper actually gets smoothed flat -
  // pressing inward would crease it further.
  const leftHand = press.interpolate({ inputRange: [0, 1], outputRange: [0, -HAND_TRAVEL] });
  const rightHand = press.interpolate({ inputRange: [0, 1], outputRange: [0, HAND_TRAVEL] });
  // Crossfaded over the first half of the press, so the paper settles before
  // the hands finish arriving rather than changing after they stop.
  const crumpledOpacity = press.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] });
  const flatOpacity = press.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  const straighten = press.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '0deg'] });

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View style={[styles.stage, { opacity: fade }]}>
        <Animated.View style={[styles.paper, { transform: [{ rotate: straighten }] }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: crumpledOpacity }]}>
            <Svg width={PAPER_W} height={PAPER_H} viewBox={`0 0 ${PAPER_W} ${PAPER_H}`}>
              <Path d={CRUMPLED} fill={colors.white} />
              <Path d={CREASES} stroke="#b9bdc2" strokeWidth={1.2} fill="none" strokeLinecap="round" />
              {/* Tilted and sheared, so the code reads as unscannable rather
                  than merely decorated. */}
              <G transform="rotate(-7 23 29) skewY(5)">
                <QrMarks />
              </G>
            </Svg>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: flatOpacity }]}>
            <Svg width={PAPER_W} height={PAPER_H} viewBox={`0 0 ${PAPER_W} ${PAPER_H}`}>
              <Rect x={4} y={2} width={38} height={54} rx={4} fill={colors.white} />
              <QrMarks />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* Drawn after the paper so the grip sits over its edges, and pulling
            outward from there is what takes the creases out. Mirrored rather
            than a second icon, so both hands are the same shape. */}
        <Animated.View style={[styles.hand, styles.handLeft, { transform: [{ translateX: leftHand }] }]}>
          <HandGrabbingIcon size={HAND_SIZE} weight="fill" color={colors.white} />
        </Animated.View>
        <Animated.View
          style={[styles.hand, styles.handRight, { transform: [{ translateX: rightHand }, { scaleX: -1 }] }]}
        >
          <HandGrabbingIcon size={HAND_SIZE} weight="fill" color={colors.white} />
        </Animated.View>
      </Animated.View>

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
    width: STAGE_W,
    height: PAPER_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paper: {
    width: PAPER_W,
    height: PAPER_H,
  },
  hand: {
    position: 'absolute',
    top: (PAPER_H - HAND_SIZE) / 2,
  },
  handLeft: {
    left: 0,
  },
  handRight: {
    right: 0,
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
