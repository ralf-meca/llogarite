import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';

// A soft teardrop rather than a triangle: both curves leave the tip
// horizontally, so their tangents match there and the two sides meet in a
// rounded point instead of a corner. The usual rotated-square trick can only
// give a corner.
const PATH = 'M0 0 C9.5 0 11.5 20.5 15 20.5 C18.5 20.5 20.5 0 30 0';

export const POPOVER_TAIL_WIDTH = 30;
export const POPOVER_TAIL_HEIGHT = 22;

type PopoverTailProps = {
  // Which way the tip points. A popover that opens below whatever opened it
  // needs the same shape the other way up.
  pointing?: 'down' | 'up';
  style?: StyleProp<ViewStyle>;
};

// Hangs under a popover and points at whatever opened it. Fill only, with no
// outline: a border cannot follow this curve into the popover's own edge
// without the join showing, so popovers wearing a tail go without one and let
// the scrim do the separating. Callers place it — the tail has no opinion about
// where the thing it points at happens to be — and are expected to overlap it a
// pixel into the popover so no hairline shows between the two white shapes.
export function PopoverTail({ pointing = 'down', style }: PopoverTailProps) {
  return (
    <Svg
      width={POPOVER_TAIL_WIDTH}
      height={POPOVER_TAIL_HEIGHT}
      style={[pointing === 'up' && styles.flipped, style]}
      pointerEvents="none"
    >
      <Path d={`${PATH} Z`} fill={colors.white} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Cheaper than a second path, and keeps one definition of the curve.
  flipped: {
    transform: [{ scaleY: -1 }],
  },
});
