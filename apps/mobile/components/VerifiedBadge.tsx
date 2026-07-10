import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from '../lib/i18n';

type VerifiedBadgeProps = {
  size?: number;
};

export function VerifiedBadge({ size = 28 }: VerifiedBadgeProps) {
  const { t } = useTranslation();
  const badgeSize = Math.round(size * 0.5);
  const badgeOffset = -badgeSize * 0.2;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <Pressable
      style={[styles.wrapper, { width: size, height: size }]}
      hitSlop={8}
      onPress={() => Alert.alert(t('verifiedBadge.title'), t('verifiedBadge.message'))}
    >
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="qr-code" size={size * 0.6} color="#374151" />
      </View>
      <View
        style={[
          styles.checkBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            right: badgeOffset,
            top: badgeOffset,
          },
        ]}
      >
        <Ionicons name="checkmark" size={badgeSize * 0.75} color="#ffffff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#ffffff',
  },
  checkBadge: {
    position: 'absolute',
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
