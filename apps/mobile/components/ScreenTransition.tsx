import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

// Forward: deeper into the app, arriving from the right. Back: out again, from the
// left. Fade: sideways between screens of the same level. None: appears as it is.
export type TransitionDirection = 'forward' | 'back' | 'fade' | 'none';

const SLIDE_DISTANCE = 28;
const DURATION_MS = 220;

type ScreenTransitionProps = {
  direction: TransitionDirection;
  children: ReactNode;
};

// Plays once, when it mounts. Give it a `key` that changes with the screen, and each
// new screen arrives with the animation instead of replacing the last one in a blink.
export function ScreenTransition({ direction, children }: ScreenTransitionProps) {
  // Read once: a direction that changes mid-flight must not move a screen already in place.
  const initialDirection = useRef(direction).current;
  const progress = useRef(new Animated.Value(initialDirection === 'none' ? 1 : 0)).current;

  useEffect(() => {
    if (initialDirection === 'none') {
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [initialDirection, progress]);

  const offset = initialDirection === 'forward' ? SLIDE_DISTANCE : initialDirection === 'back' ? -SLIDE_DISTANCE : 0;

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          opacity: progress,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
