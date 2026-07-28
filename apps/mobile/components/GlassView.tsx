import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

type GlassViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: 'light' | 'dark';
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function GlassView({ children, style, tint = 'light', onLayout }: GlassViewProps) {
  return (
    <View style={[styles.base, tint === 'dark' && styles.dark, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dark: {
    borderWidth: 0,
    backgroundColor: colors.scrim,
  },
});
