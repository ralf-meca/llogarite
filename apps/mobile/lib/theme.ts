import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

// How far a screen's header sits from the top. Android reports its status bar
// height; iOS does not, so there it is the safe area - which is what clears the
// notch or the Dynamic Island.
const TOP_INSET =
  Platform.OS === 'ios' ? (initialWindowMetrics?.insets.top ?? 47) : (StatusBar.currentHeight ?? 32);

export const HEADER_INSET = TOP_INSET + 8;

export const colors = {
  primary: '#5980A6',
  primaryLight: '#8FAAC6',
  primaryTint: '#EEF6FF',
  primarySubtle: '#C9D8E5',
  textDark: '#1D1F20',
  textMuted: '#6F7375',
  white: '#FFFFFF',
  danger: '#dc2626',
  dangerTint: '#FEE2E2',
  border: '#E7E7EA',
  scrim: 'rgba(29,31,32,0.5)',
  background: '#F2F2F3',
  neutral: '#F5F5F5',
} as const;

// Geometry of the floating scan button. OnboardingGuide draws its spotlight from
// these too, so the highlight can't drift away from the button again.
export const FAB_SIZE = 56;
export const FAB_BOTTOM_OFFSET = 18;

// Height of the fixed bottom navigation bar. Screens inside the sheet pad their
// scroll content by this much so the last row clears the bar.
export const BOTTOM_NAV_HEIGHT = 70;

export const radius = {
  card: 18,
  pill: 999,
  sheet: 24,
} as const;
