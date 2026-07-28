import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';

type VerifiedBadgeProps = {
  size?: number;
};

const POPOVER_WIDTH = 220;
const TAIL_SIZE = 7;

export function VerifiedBadge({ size = 28 }: VerifiedBadgeProps) {
  const { t } = useTranslation();
  const badgeSize = Math.round(size * 0.5);
  const badgeOffset = -badgeSize * 0.2;
  const pulse = useRef(new Animated.Value(0)).current;
  const wrapperRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

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

  const handlePress = () => {
    wrapperRef.current?.measureInWindow((x, y, width) => {
      setAnchor({ x: x + width / 2, y });
    });
  };

  return (
    <>
      <Pressable
        ref={wrapperRef}
        style={[styles.wrapper, { width: size, height: size }]}
        hitSlop={8}
        onPress={handlePress}
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

      <Modal visible={anchor !== null} transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAnchor(null)}>
          {anchor &&
            (() => {
              const screenWidth = Dimensions.get('window').width;
              const popoverLeft = Math.max(12, Math.min(anchor.x - POPOVER_WIDTH / 2, screenWidth - POPOVER_WIDTH - 12));
              const tailLeft = Math.max(
                TAIL_SIZE * 2,
                Math.min(anchor.x - popoverLeft - TAIL_SIZE, POPOVER_WIDTH - TAIL_SIZE * 3),
              );
              return (
                <View
                  style={[
                    styles.popoverWrapper,
                    { left: popoverLeft, bottom: Dimensions.get('window').height - anchor.y + 4 },
                  ]}
                >
                  <View style={styles.popover}>
                    <Text style={styles.popoverTitle}>{t('verifiedBadge.title')}</Text>
                    <Text style={styles.popoverMessage}>{t('verifiedBadge.message')}</Text>
                  </View>
                  <View style={[styles.tail, { left: tailLeft }]} />
                </View>
              );
            })()}
        </Pressable>
      </Modal>
    </>
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
  backdrop: {
    flex: 1,
  },
  popoverWrapper: {
    position: 'absolute',
    width: POPOVER_WIDTH,
  },
  popover: {
    width: POPOVER_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    boxShadow: '0px 4px 12px rgba(0,0,0,0.2)',
  },
  tail: {
    position: 'absolute',
    bottom: -TAIL_SIZE + 1,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderTopWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  popoverTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  popoverMessage: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});
