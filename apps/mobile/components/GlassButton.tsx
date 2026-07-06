import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

type GlassButtonVariant = 'default' | 'accent' | 'danger';

type GlassButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: GlassButtonVariant;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const variantBackground: Record<GlassButtonVariant, string> = {
  default: colors.white,
  accent: colors.primary,
  danger: colors.white,
};

const variantBorderColor: Record<GlassButtonVariant, string> = {
  default: colors.border,
  accent: colors.primary,
  danger: colors.danger,
};

const variantTextColor: Record<GlassButtonVariant, string> = {
  default: colors.textDark,
  accent: colors.white,
  danger: colors.danger,
};

export function GlassButton({ label, onPress, disabled, variant = 'default', icon, style }: GlassButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrapper,
        { backgroundColor: variantBackground[variant], borderColor: variantBorderColor[variant] },
        style,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: variantTextColor[variant] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
  },
});
