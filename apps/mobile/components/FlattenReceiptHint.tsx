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
// The hand keeps its own 325x239 box so its proportions are not re-guessed;
// these are the on-screen size at that ratio. Wider than this and the fingers
// cover the code they are meant to be presenting.
// Upright, so the pinch meets the receipt's edge rather than lying across it.
// These are the box the artwork is drawn into before that quarter turn, which
// is why they look transposed.
const HAND_W = 35;
const HAND_H = 48;
// The hands overlap the paper's edges rather than sitting beside it, so they
// read as holding it rather than gesturing at it.
const HAND_OVERLAP = 12;
const STAGE_W = PAPER_W + 2 * (HAND_W - HAND_OVERLAP);

// Both long edges bow in and out - what a receipt that has been in a pocket
// looks like from the front.
const CRUMPLED =
  'M8 2 C12 8 3 13 8 19 C13 25 4 30 9 36 C14 42 5 47 9 56 L38 56 C34 48 43 43 38 37 C33 31 42 26 37 20 C32 14 41 9 38 2 Z';
const CREASES = 'M11 14 L35 18 M10 30 L36 27 M12 44 L34 47';

// Phosphor has no pinch gesture in this version, and the shapes I drew by hand
// came out as pincers, so this is the traced artwork - one path, its own box.
const PINCH_HAND_VIEWBOX = '0 0 441 355';
const PINCH_HAND = 'M 232.0,124.0 L 230.0,126.0 L 230.0,131.0 L 244.0,150.0 L 250.0,155.0 L 255.0,154.0 L 256.0,148.0 L 237.0,124.0 Z M 372.0,124.0 L 368.0,115.0 L 364.0,111.0 L 345.0,103.0 L 345.0,92.0 L 339.0,81.0 L 330.0,75.0 L 322.0,73.0 L 313.0,74.0 L 236.0,101.0 L 226.0,97.0 L 215.0,97.0 L 114.0,118.0 L 71.0,96.0 L 67.0,96.0 L 64.0,99.0 L 64.0,191.0 L 67.0,194.0 L 98.0,209.0 L 117.0,230.0 L 126.0,236.0 L 141.0,242.0 L 152.0,243.0 L 163.0,248.0 L 236.0,295.0 L 245.0,297.0 L 252.0,296.0 L 262.0,291.0 L 267.0,284.0 L 272.0,281.0 L 284.0,282.0 L 291.0,279.0 L 297.0,273.0 L 300.0,266.0 L 300.0,209.0 L 287.0,192.0 L 288.0,187.0 L 293.0,185.0 L 345.0,207.0 L 357.0,206.0 L 367.0,199.0 L 372.0,189.0 L 371.0,175.0 L 362.0,164.0 L 351.0,159.0 L 350.0,154.0 L 361.0,149.0 L 368.0,143.0 L 372.0,134.0 Z M 202.0,188.0 L 211.0,183.0 L 219.0,186.0 L 257.0,224.0 L 257.0,239.0 L 252.0,242.0 L 248.0,240.0 L 208.0,208.0 L 200.0,199.0 L 200.0,192.0 Z M 274.0,116.0 L 279.0,113.0 L 351.0,116.0 L 361.0,123.0 L 362.0,132.0 L 360.0,136.0 L 352.0,142.0 L 323.0,145.0 L 275.0,121.0 Z M 75.0,114.0 L 81.0,112.0 L 114.0,128.0 L 215.0,107.0 L 225.0,107.0 L 357.0,173.0 L 362.0,180.0 L 362.0,187.0 L 356.0,195.0 L 346.0,197.0 L 264.0,162.0 L 259.0,163.0 L 257.0,166.0 L 258.0,170.0 L 290.0,212.0 L 290.0,265.0 L 286.0,270.0 L 276.0,272.0 L 271.0,269.0 L 270.0,262.0 L 267.0,257.0 L 267.0,220.0 L 224.0,177.0 L 217.0,174.0 L 206.0,174.0 L 199.0,177.0 L 193.0,183.0 L 190.0,190.0 L 190.0,201.0 L 194.0,209.0 L 257.0,260.0 L 257.0,265.0 L 260.0,271.0 L 259.0,279.0 L 250.0,286.0 L 240.0,286.0 L 159.0,234.0 L 142.0,232.0 L 129.0,226.0 L 117.0,216.0 L 106.0,202.0 L 74.0,185.0 Z M 335.0,94.0 L 335.0,102.0 L 330.0,105.0 L 288.0,104.0 L 283.0,101.0 L 284.0,95.0 L 318.0,83.0 L 323.0,83.0 L 329.0,86.0 Z';
// Filled and outlined rather than left as line art: half of each hand sits
// over a white receipt, where white on white would be nothing at all.
//
// Off-white rather than white, and a thin outline rather than a thick one. At
// nine the outline expanded into the gaps between the fingers and welded them
// into solid white blobs; at four the fingers stay separate lines.
const HAND_FILL = '#d9dde0';
const HAND_OUTLINE = 'rgba(0,0,0,0.45)';
const HAND_OUTLINE_WIDTH = 4;

// The quarter turn lives here and the mirrors live on the wrapper outside, so
// each hand is turned first and then flipped in the axis you actually see on
// screen. Doing both in one transform list makes the order matter, and the
// answer stops being obvious.
function PinchHand() {
  return (
    <Svg width={HAND_W} height={HAND_H} viewBox={PINCH_HAND_VIEWBOX} style={styles.handTurn}>
      <Path
        d={PINCH_HAND}
        fill={HAND_FILL}
        fillRule="evenodd"
        stroke={HAND_OUTLINE}
        strokeWidth={HAND_OUTLINE_WIDTH}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
        <Animated.View
          style={[styles.hand, styles.handLeft, { transform: [{ translateX: leftHand }] }]}
        >
          <View style={styles.handLeftFlip}>
            <PinchHand />
          </View>
        </Animated.View>
        <Animated.View
          style={[styles.hand, styles.handRight, { transform: [{ translateX: rightHand }] }]}
        >
          <PinchHand />
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
  handTurn: {
    transform: [{ rotate: '90deg' }],
  },
  // Both axes, which is a half turn - but written as two flips because that is
  // how the pair is reasoned about: each hand mirrored so its fingers point at
  // the receipt rather than away from it.
  handLeftFlip: {
    transform: [{ scaleX: -1 }, { scaleY: -1 }],
  },
  hand: {
    position: 'absolute',
    top: (PAPER_H - HAND_H) / 2,
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
