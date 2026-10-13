import { MoonIcon, SunIcon } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

const TRACK_WIDTH = 60;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 26;
const INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - INSET * 2;

// The colours are the switch's own, the same by day and by night: it is a picture of
// the two modes, so it must not itself be recoloured by the one that is on.
const DAY_TRACK = '#6FB6EE';
const NIGHT_TRACK = '#22344A';
const SUN = '#EA7A00';
const MOON = '#5B7FA8';
// Around the night track, which is close in tone to a dark page and would otherwise
// sink into it and stop reading as a switch.
const NIGHT_OUTLINE = '#6C8FB8';
const OUTLINE_WIDTH = 1.5;

type NightModeSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

// A switch whose knob carries a sun by day and a moon by night, and slides from one
// side of a sky-coloured track to the other.
export function NightModeSwitch({ value, onValueChange }: NightModeSwitchProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      friction: 8,
      tension: 140,
      // The track's colour is animated too, which the native driver cannot do.
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [DAY_TRACK, NIGHT_TRACK] }),
            // By day the outline is the track's own colour, so it is not seen.
            borderColor: progress.interpolate({ inputRange: [0, 1], outputRange: [DAY_TRACK, NIGHT_OUTLINE] }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }] },
          ]}
        >
          {/* Both are there, one fading into the other as the knob crosses. */}
          <Animated.View style={[styles.icon, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <SunIcon size={20} weight="fill" color={SUN} />
          </Animated.View>
          <Animated.View style={[styles.icon, { opacity: progress }]}>
            <MoonIcon size={16} weight="fill" color={MOON} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: OUTLINE_WIDTH,
    padding: INSET - OUTLINE_WIDTH,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFDFD',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
  },
  icon: {
    position: 'absolute',
  },
});
