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
const HAND_W = 48;
const HAND_H = 35;
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
const PINCH_HAND_VIEWBOX = '0 0 325 239';
const PINCH_HAND = 'M316.0,60.0 L314.0,53.0 L306.0,44.0 L299.0,41.0 L288.0,39.0 L289.0,27.0 L285.0,18.0 L279.0,12.0 L270.0,8.0 L258.0,8.0 L181.0,35.0 L169.0,31.0 L160.0,31.0 L57.0,52.0 L14.0,30.0 L11.0,30.0 L8.0,34.0 L8.0,124.0 L10.0,127.0 L41.0,142.0 L53.0,156.0 L67.0,168.0 L86.0,176.0 L99.0,177.0 L176.0,227.0 L184.0,230.0 L195.0,230.0 L204.0,226.0 L214.0,214.0 L219.0,216.0 L227.0,216.0 L236.0,212.0 L242.0,205.0 L244.0,199.0 L244.0,144.0 L223.0,115.0 L227.0,114.0 L229.0,116.0 L239.0,119.0 L243.0,122.0 L286.0,140.0 L300.0,140.0 L306.0,137.0 L312.0,131.0 L315.0,125.0 L315.0,110.0 L308.0,100.0 L286.0,89.0 L285.0,87.0 L299.0,85.0 L306.0,82.0 L312.0,76.0 L315.0,70.0 Z M18.0,43.0 L54.0,61.0 L62.0,61.0 L163.0,40.0 L170.0,41.0 L300.0,106.0 L306.0,113.0 L306.0,122.0 L301.0,129.0 L297.0,131.0 L290.0,131.0 L262.0,120.0 L260.0,118.0 L257.0,118.0 L248.0,113.0 L244.0,114.0 L243.0,111.0 L209.0,97.0 L207.0,97.0 L206.0,99.0 L205.0,97.0 L202.0,98.0 L202.0,104.0 L235.0,147.0 L235.0,196.0 L233.0,201.0 L229.0,205.0 L222.0,207.0 L218.0,206.0 L215.0,203.0 L214.0,197.0 L211.0,192.0 L210.0,153.0 L166.0,110.0 L160.0,108.0 L152.0,108.0 L142.0,112.0 L137.0,118.0 L136.0,123.0 L134.0,125.0 L134.0,134.0 L139.0,144.0 L202.0,195.0 L202.0,201.0 L205.0,206.0 L202.0,215.0 L195.0,220.0 L186.0,221.0 L181.0,219.0 L105.0,169.0 L85.0,166.0 L74.0,161.0 L67.0,156.0 L48.0,135.0 L17.0,119.0 Z M206.0,48.0 L231.0,47.0 L297.0,50.0 L304.0,55.0 L306.0,59.0 L306.0,67.0 L304.0,71.0 L297.0,76.0 L266.0,79.0 Z M149.0,119.0 L154.0,117.0 L159.0,117.0 L202.0,159.0 L201.0,180.0 L199.0,180.0 L146.0,137.0 L143.0,128.0 Z M280.0,30.0 L279.0,38.0 L277.0,40.0 L221.0,38.0 L209.0,36.0 L210.0,34.0 L261.0,17.0 L268.0,17.0 L275.0,21.0 Z M176.0,58.0 L174.0,61.0 L175.0,66.0 L193.0,89.0 L197.0,89.0 L200.0,85.0 L199.0,81.0 L181.0,58.0 Z';
// Filled white and outlined rather than left as line art: half of each hand
// sits over a white receipt, where white on white would be nothing at all.
const HAND_OUTLINE = 'rgba(0,0,0,0.45)';

function PinchHand() {
  return (
    <Svg width={HAND_W} height={HAND_H} viewBox={PINCH_HAND_VIEWBOX}>
      <Path
        d={PINCH_HAND}
        fill={colors.white}
        fillRule="evenodd"
        stroke={HAND_OUTLINE}
        strokeWidth={9}
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
        <Animated.View style={[styles.hand, styles.handLeft, { transform: [{ translateX: leftHand }] }]}>
          <PinchHand />
        </Animated.View>
        <Animated.View
          style={[styles.hand, styles.handRight, { transform: [{ translateX: rightHand }, { scaleX: -1 }] }]}
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
