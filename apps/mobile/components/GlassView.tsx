import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type GlassViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark';
};

export function GlassView({ children, style, intensity = 40, tint = 'light' }: GlassViewProps) {
  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.base, tint === 'dark' && styles.dark, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dark: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
