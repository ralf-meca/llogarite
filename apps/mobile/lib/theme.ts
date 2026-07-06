import { StatusBar } from 'react-native';

export const HEADER_INSET = (StatusBar.currentHeight ?? 32) + 8;

export const colors = {
  primary: '#5B7FDB',
  primaryLight: '#8DA6E8',
  primaryTint: '#EEF2FC',
  primarySubtle: '#D3DEF7',
  textDark: '#22314F',
  textMuted: '#7A8BB8',
  white: '#FFFFFF',
  danger: '#dc2626',
  dangerTint: '#FEE2E2',
  border: '#E7ECFB',
  scrim: 'rgba(10,16,36,0.55)',
} as const;

export const radius = {
  card: 18,
  pill: 999,
  sheet: 24,
} as const;
