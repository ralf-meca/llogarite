import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

type GlassButtonVariant = 'default' | 'accent' | 'danger';

type GlassButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: GlassButtonVariant;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const variantTint: Record<GlassButtonVariant, string> = {
  default: 'rgba(255,255,255,0.3)',
  accent: 'rgba(37,99,235,0.55)',
  danger: 'rgba(220,38,38,0.18)',
};

const variantTextColor: Record<GlassButtonVariant, string> = {
  default: '#1f2937',
  accent: '#ffffff',
  danger: '#dc2626',
};

export function GlassButton({ label, onPress, disabled, variant = 'default', icon, style }: GlassButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.wrapper, style, (pressed || disabled) && styles.pressed]}
    >
      <BlurView intensity={50} tint="light" style={[styles.blur, { backgroundColor: variantTint[variant] }]}>
        {icon}
        <Text style={[styles.label, { color: variantTextColor[variant] }]}>{label}</Text>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
  },
});
